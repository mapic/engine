// API: api.upload.js
// database schemas
var Project 	= require('../models/project');
var Clientel 	= require('../models/client');	// weird name cause 'Client' is restricted name
var User  	= require('../models/user');
var File 	= require('../models/file');
var Layer 	= require('../models/layer');
var Hash 	= require('../models/hash');
var Role 	= require('../models/role');
var Group 	= require('../models/group');

// utils
var _ 		= require('lodash-node');
var fs 		= require('fs-extra');
var gm 		= require('gm');
var kue 	= require('kue');
var fss 	= require("q-io/fs");
var srs 	= require('srs');
var zlib 	= require('zlib');
var uuid 	= require('node-uuid');
var util 	= require('util');
var utf8 	= require("utf8");
var mime 	= require("mime");
var exec 	= require('child_process').exec;
var dive 	= require('dive');
var async 	= require('async');
var carto 	= require('carto');
var crypto      = require('crypto');
var fspath 	= require('path');
var mapnik 	= require('mapnik');
var request 	= require('request');
var nodepath    = require('path');
var formidable  = require('formidable');
var nodemailer  = require('nodemailer');
var uploadProgress = require('node-upload-progress');
var mapnikOmnivore = require('mapnik-omnivore');

var geojsonArea = require('geojson-area');

// resumable.js
var r = require('../tools/resumable-node')('/data/tmp/');

// postgres
var pg = require('pg');

// api
var api = module.parent.exports;

// exports
module.exports = api.postgis = { 

	

	deleteTable : function (options, done) {
		var database_name = options.database_name,
		    table_name = options.table_name,
		    DROP_TABLE_SCRIPT = '../scripts/postgis/drop_table.sh';

		// missing information
		if (!database_name || !table_name) return api.error.missingInformation(req, res);

		// validation
		if (!table_name.length == 25) return api.error.general(req, res, 'Invalid table name!' + table_name);

		var command = [
			DROP_TABLE_SCRIPT,
			database_name,
			table_name
		].join(' ');

		// create database in postgis
		exec(command, {maxBuffer: 1024 * 50000}, function (err) {
			if (err) return done(err);
			done(null);
		});
	},


	_cleanSQLQuery : function (sql) {
		var sql = sql;
		var a = sql.replace('(', '');
		var b = a.replace(') as sub', '');
		var c = b.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var c = c.replace('\n', ' ');
		var cleanSQL = '"' + c + '"';
		return cleanSQL;
	},

	_setDownloadProgress : function (options, callback) {
		var id = 'download_status:' + options.download_status_id;
		api.redis.layers.set(id, JSON.stringify(options), callback);
	},

	_getDownloadProgress : function (options, callback) {
		var id = 'download_status:' + options.download_status_id;
		api.redis.layers.set(id, callback);
	},

	// query progress by GET
	getDownloadProgress : function (req, res) {
		var options = req.body,
		    download_status_id = options.download_status_id;
		
		if (!download_status_id) return api.error.missingInformation(req, res);

		// get status
		api.postgis._getDownloadProgress(options, function (err, status) {
			if (err) return api.error.general(req, res, err);

			// return status
			res.json(status);
		});
	},


	downloadDatasetFromLayer : function (req, res) {

		var options = req.body,
		    layer_id = options.layer_id,
		    format = options.format,
		    user = req.user,
		    ops = [],
		    layername;

		// set download status is
		var download_status_id = api.utils.getRandomChars(8);
		var status = {
			download_status_id : download_status_id,
			finished : false,
			time_start : Date().now,
			file_id : layer_id
		}

		// set download status
		api.postgis._setDownloadProgress(status);

		// return result
		res.json(status);

		ops.push(function (callback) {
			Layer
			.findOne({uuid : layer_id})
			.exec(callback);
		});

		ops.push(function (layer, callback) {

			layername = layer.title.replace(/ /g,'').replace('.zip', '');

			var opts = {
				database_name 	: layer.data.postgis.database_name,
				table_name 	: layer.data.postgis.table_name,
				data_type 	: layer.data.postgis.data_type,
				query 		: api.postgis._cleanSQLQuery(layer.data.postgis.sql),
				name 		: layername,
				user 		: req.user
			}

			// get dataset
			api.postgis.downloadDataset(opts, callback);
		});

		async.waterfall(ops, function (err, filepath) {

			var status = {
				download_status_id : download_status_id,
				finished : true,
				filepath : filepath,
				file_id : layer_id
			}

			// set download status
			api.postgis._setDownloadProgress(status);

			// send socket notification (if subscribed)
			if (options.socket_notification) api.socket.downloadReady({
				user : req.user,
				status : status
			});

			// send to slack
			api.analytics.downloadedDataset({
				user : user,
				filename : layername
			})
		});

	},



	downloadDatasetFromFile: function (req, res) {
		var options = req.body,
		    file_id = options.file_id,
		    format = options.format,
		    user = req.user,
		    ops = [],
		    filename;

		// set download status is
		var download_status_id = api.utils.getRandomChars(8);
		var status = {
			download_status_id : download_status_id,
			finished : false,
			time_start : Date().now,
			file_id : file_id
		}

		// set download status
		api.postgis._setDownloadProgress(status);

		// return result
		res.json(status);

		// get file
		ops.push(function (callback) {
			File
			.findOne({uuid : file_id})
			.exec(callback);
		});

		ops.push(function (file, callback) {

			var table_name = file.data.postgis.table_name;
			filename = file.name.replace(/ /g,'').replace('.zip', '');

			var options = {
				database_name 	: file.data.postgis.database_name,
				table_name 	: file.data.postgis.table_name,
				data_type 	: file.data.postgis.data_type,
				query 		: '"SELECT * FROM ' + table_name + '"',
				name 		: filename,
				user 		: req.user
			}

			// get dataset
			api.postgis.downloadDataset(options, callback);
		});

		async.waterfall(ops, function (err, filepath) {

			var status = {
				download_status_id : download_status_id,
				finished : true,
				filepath : filepath,
				file_id : file_id
			}

			// set download status
			api.postgis._setDownloadProgress(status);

			// send socket notification (if subscribed)
			if (options.socket_notification) api.socket.downloadReady({
				user : req.user,
				status : status
			});

			// send to slack
			api.analytics.downloadedDataset({
				user : user,
				filename : filename
			})
		});
	},

	downloadDataset : function (options, done) {
		var database_name = options.database_name,
		    table_name = options.table_name,
		    data_type = options.data_type,
		    query = options.query,
		    name = options.name,
		    user = options.user,
		    ops = [];


		ops.push(function (callback) {

			var sanitize = require("sanitize-filename");


			// where to put file
			var filePath = database_name + '/' + table_name + '/' +  api.utils.getRandomChars(5) + '/',
			    folder = api.config.path.temp + filePath,
			    filename = sanitize(name),
			    output = folder + filename,
			    returnOutput = filePath + filename,
			    DOWNLOAD_TABLE_SCRIPT = '../scripts/postgis/download_table.sh';


			// create folder
			fs.ensureDir(folder, function (err) {

				var command = [
					DOWNLOAD_TABLE_SCRIPT,
					database_name,
					output,
					query
				].join(' ');

				console.log('dump to shp cmd: ', command);

				// create database in postgis
				exec(command, {maxBuffer: 1024 * 50000}, function (err, stdout) {
					console.log('err, stdout', err, stdout);

					if (err) return callback(err);

					var options = {
						zipfolder : folder,
						zipfile : folder + filename,
						returnOutput : returnOutput
					}
					
					callback(null, options);

				});
			});
		});


		ops.push(function (options, callback) {
			var zipfolder = options.zipfolder,
			    tarfile = options.zipfile + '.tar',
			    zipfile = tarfile + '.gz',
			    returnOutput = options.returnOutput + '.tar.gz';

			var cmd = [
				'tar',
				'cvf',
				// 'loka.tar',
				tarfile,
				'-C',
				'"' + zipfolder + '"',
				'.',
				'&&',
				'pigz',
				tarfile
				// 'loka.tar'
				// zipfile
			].join(' ');

			console.log('tar cmd: ', cmd);

			exec(cmd, {maxBuffer: 1024 * 50000}, function (err, stdout) {
				console.log('err, stdout', err, stdout);

				if (err) return callback(err);
				callback(null, returnOutput);
			});
		});

		async.waterfall(ops, function (err, zipfile) {
			done(err, zipfile);
		});

	},

	
	createDatabase : function (options, done) {
		var user = options.user,
		    userUuid = options.user.uuid,
		    userName = '"' + options.user.firstName + ' ' + options.user.lastName + '"',
		    pg_db = api.utils.getRandomChars(10),
		    CREATE_DB_SCRIPT_PATH = '../scripts/postgis/create_database.sh'; // todo: put in config
		
		// create database script
		var command = [
			CREATE_DB_SCRIPT_PATH, 	// script
			pg_db, 			// database name
			userName,		// username
			userUuid		// userUuid
		].join(' ');

		// create database in postgis
		exec(command, {maxBuffer: 1024 * 50000}, function (err) {
			if (err) return done(err);

			// save pg_db name to user
			User
			.findOne({uuid : userUuid})
			.exec(function (err, usr) {
				usr.postgis_database = pg_db;
				usr.save(function (err) {
					options.user = usr; // add updated user
					done(null, options);
				});
			});
		});
	},


	ensureDatabaseExists : function (options, done) {
		var userUuid = options.user.uuid;

		User
		.findOne({uuid : userUuid})
		.exec(function (err, user) {
			if (err) return done(err);

			// if already exists, return
			if (user.postgis_database) return done(null, options);

			// doesn't exist, must create
			api.postgis.createDatabase(options, function (err, opts) {
				if (err) return done(err);

				// all good
				done(null, opts);
			});
		});
	},


	import : function (options, done) {

		var ops = [];

		// ensure database exists
		ops.push(function (callback) {
			api.postgis.ensureDatabaseExists(options, callback);
		});

		// import according to type
		ops.push(function (options, callback) {

			// get which type of data
			var geotype = api.postgis._getGeotype(options);

			// if no geotype, something's wrong
			if (!geotype) return callback('api.upload.organizeImport err 4: invalid geotype!');

			// send to appropriate api.postgis.import
			if (geotype == 'shapefile') 	return api.postgis.importShapefile(options, callback);
			if (geotype == 'geojson') 	return api.postgis.importGeojson(options, callback);
			if (geotype == 'raster') 	return api.postgis.importRaster(options, callback);

			// not type caught, err
			callback('Not a valid geotype. Must be Shapefile, GeoJSON or Raster.');
		});

		async.waterfall(ops, done);

	},

	_getSrid : function (prj, done) {

		if (!prj) return done(null, false);

		fs.readFile(prj, function (err, prj4) {
			var srid = srs.parse(prj4);

			console.log('got node srid:', srid);

			// if failed, ask boundlessgeo (fml)
			if (err || !srid.srid) return api.postgis._fetchSrid(prj4, done);

			done(err, srid.srid);
		});
	
	},

	_fetchSrid : function (prj, done) {

		var terms = encodeURIComponent(prj);
		// http://prj2epsg.org/apidocs.html
		var url = 'http://prj2epsg.org/search.json?mode=wkt&terms=' + terms;
		var options = {
			url: url,
			method: 'GET',
		}

		// Start the request
		request(options, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var srids = JSON.parse(body);
				console.log('got internet srid: ', srids);
				var srid = srids.codes[0].code;
				done(null, srid);
			}
		});

	},


	importShapefile : function (options, done) {
		var files 	= options.files,
		    shape 	= api.geo.getTheShape(files)[0],
		    prjfile 	= api.geo.getTheProjection(files)[0],
		    file_id 	= options.file_id,
		    pg_db 	= options.user.postgis_database,
		    user_id 	= options.user_id,
		    uniqueIdentifier = options.uniqueIdentifier,
		    ops 	= [];



		if (!prjfile) return done('Please provide a projection file.');

		// todo: put in config
		var IMPORT_SHAPEFILE_SCRIPT_PATH = '../scripts/postgis/import_shapefile.sh'; 
		
		// read projection
		ops.push(function (callback) {

			// get srid
			api.postgis._getSrid(prjfile, callback);
		});


		// import with bash script
		ops.push(function (srid, callback) {

			console.log('final srid: ', srid);

			var srid_converted = srid;// + ':3857';  // convert on import. todo: create the_geom + the_geom_webmercator columns after import instead

			// create database script
			var cmd = [
				IMPORT_SHAPEFILE_SCRIPT_PATH, 	// script
				'"' + shape + '"',
				file_id,
				pg_db,
				srid_converted
			].join(' ');


			console.log('import shaepfile cmd: ', cmd);

			// ping progress
			api.socket.processingProgress({
				user_id : user_id,
				progress : {
					text : 'Importing...',
					error : null,
					percent : 30,
					uniqueIdentifier : uniqueIdentifier,
				}
			});

			// import to postgis
			var startTime = new Date().getTime();
			exec(cmd, {maxBuffer: 1024 * 1024 * 50000}, function () {
				// console.log('srr, std', err, stdout);
				// if (err) {
				// 	console.log('import_shapefile_script err: ', err, stdout);
				// }

				var endTime = new Date().getTime();

				// set import time to status
				api.upload.updateStatus(file_id, { 	// todo: set err if err
					data_type : 'vector',
					import_took_ms : endTime - startTime,
					table_name : file_id,
					database_name : pg_db
				}, function (err) {
					callback(err, 'Shapefile imported successfully.');
				});
			});
		});

		// prime geometries in new table
		ops.push(function (success, callback) {

			// ping progress
			api.socket.processingProgress({
				user_id : user_id,
				progress : {
					text : 'Creating geometries...',
					error : null,
					percent : 60,
					uniqueIdentifier : uniqueIdentifier,
				}
			});

			api.postgis._primeTableWithGeometries({
				file_id : file_id,
				postgis_db : pg_db,
			}, callback);
		});

		// get metadata
		ops.push(function (callback) {

			// ping progress
			api.socket.processingProgress({
				user_id : user_id,
				progress : {
					text : 'Getting metadata...',
					error : null,
					percent : 70,
					uniqueIdentifier : uniqueIdentifier,
				}
			});

			api.postgis._getMetadata({
				file_id : file_id,
				postgis_db : pg_db
			}, function (err, metadata) {
				if (err) return callback(err);

				var metadataJSON = JSON.stringify(metadata);

				// set upload status
				api.upload.updateStatus(file_id, {
					metadata : metadataJSON
				}, callback);
			})

		});

		
		// count rows for upload status
		ops.push(function (callback) {

			// ping progress
			api.socket.processingProgress({
				user_id : user_id,
				progress : {
					text : 'Almost done...',
					error : null,
					percent : 90,
					uniqueIdentifier : uniqueIdentifier,
				}
			});
			
			api.postgis.query({
				postgis_db : pg_db,
				query : 'SELECT count(*) from "' + file_id + '"'
			}, function (err, result) {
				if (err) return callback(err);
				
				// set upload status
				api.upload.updateStatus(file_id, {
					rows_count : result.rows[0].count
				}, callback);
			});
		});

		// run ops
		async.waterfall(ops, done);

	},


	importGeojson : function (options, done) {

		// need to convert to ESRI shapefile (ouch!) first..
		var geojsonPath = options.files[0],
		    geojsonBasename = api.postgis._getBasefile(geojsonPath),
		    shapefileFolder = '/data/tmp/' + api.utils.getRandom(5) + '/',
		    shapefileBasename = geojsonBasename + '.shp',
		    shapefilePath = shapefileFolder + shapefileBasename,
		    ops = [];

		console.log('importGeojson options: ', options);
		var file_id = options.file_id;

		// create dir
		ops.push(function (callback) {
			fs.ensureDir(shapefileFolder, callback);
		});

		// convert to shape
		ops.push(function (callback) {
			var cmd = [
				'ogr2ogr',
				'-f',
				'"ESRI Shapefile"',
				shapefilePath,
				geojsonPath
			].join(' ');

			exec(cmd, callback);
		});


		ops.push(function (callback) {

			// get content of dir
			fs.readdir(shapefileFolder, function (err, files) {
				if (err) return callback(err);

				// add path to files, and add to options
				options.files = [];
				files.forEach(function (file) {
					options.files.push(shapefileFolder + file);
				});

				callback(null);
			});
		});


		ops.push(function (callback) {

			// do shapefile import
			api.postgis.importShapefile(options, function (err, results) {

				// set upload status
				api.upload.updateStatus(file_id, {
					original_format : 'GeoJSON',
				}, function () {
					// return
					callback(err, results);
				});
			});

		});

		// run ops
		async.series(ops, done);
	},

	
	importRaster : function (options, done) {
		var clientName 	= options.clientName,
		    raster 	= options.files[0],
		    // file_id 	= 'raster_' + api.utils.getRandom(10),
		    file_id 	= options.file_id,
		    pg_db 	= options.user.postgis_database,
		    original_format = api.postgis._getRasterType(raster);

		var IMPORT_RASTER_SCRIPT_PATH = '../scripts/postgis/import_raster.sh'; // todo: put in config
		
		// create database script
		var cmd = [
			IMPORT_RASTER_SCRIPT_PATH,
			raster,
			file_id,
			pg_db
		].join(' ');

		// import to postgis
		var startTime = new Date().getTime();
		exec(cmd, {maxBuffer: 1024 * 50000}, function (err) {
			var endTime = new Date().getTime();

			// set err on upload status
			if (err) return api.upload.updateStatus(file_id, {
				error_code : 2,
				error_text : err
			}, function () {
				// return
				done(err);
			});


			// set upload status
			api.upload.updateStatus(file_id, {
				data_type : 'raster',
				original_format : original_format,
				import_took_ms : endTime - startTime,
				table_name : file_id,
				database_name : pg_db
			}, function () {
				// return
				done(err, 'Raster imported successfully.');
			});
		});

	},


	_getMetadata : function (options, done) {
		var file_id = options.file_id, 
		    postgis_db = options.postgis_db,
		    ops = [],
		    metadata = {};

		// get extent
		ops.push(function (callback) {

			var query = 'SELECT ST_Extent(the_geom_4326) FROM ' + file_id;

			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback(err);
										// todo: get extent as geojson polygon
				// old skool
				var box = results.rows[0].st_extent;
				var m = box.split('(')[1];
				var m2 = m.split(')')[0];
				var c1 = m2.split(' ')[0];
				var c2 = m2.split(' ')[1].split(',')[0];
				var c3 = m2.split(',')[1].split(' ')[0];
				var c4 = m2.split(' ')[2];

				// set
				metadata.extent = [c1, c2, c3, c4];
				
				callback(null);
			});	
		});

		// get min/max of all fields
		ops.push(function (callback) {


			var query = 'SELECT * FROM ' + file_id + ' LIMIT 1';

			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {

				var rows = results.rows[0];
				var columns = [];
				var min_max_values = {};
				var jobs = [];

				for (var r in rows) {
					if (r != 'geom' && r != 'the_geom_3857' && r != 'the_geom_4326') {
						columns.push(r);
					}
				}

				columns.forEach(function (column) {

					min_max_values[column] = {
						min : 0,
						max : 0
					};

					jobs.push(function (done) {
						
						// get max values

						// do sql query on postgis
						var MAX_SCRIPT = '../scripts/postgis/get_max_of_column.sh'; 

						// st_extent script 
						var command = [
							MAX_SCRIPT, 	// script
							postgis_db, 	// database name
							file_id,	// table name
							column
						].join(' ');


						// create database in postgis
						exec(command, {maxBuffer: 1024 * 50000}, function (err, stdout, stdin) {
							if (err) return done(null);

							var json = stdout.split('\n')[2];
							var data = JSON.parse(json);
							
							min_max_values[column] = data;

							// callback
							done(null, data);
						});
					});	
				});


				async.parallel(jobs, function (err, values) {
					min_max_values._columns = columns;
					metadata.columns = min_max_values;

					callback(null);
				});
			});
		});

		// get total area
		ops.push(function (callback) {

			var GET_EXTENT_SCRIPT_PATH = '../scripts/postgis/get_st_extent_as_geojson.sh';

			// st_extent script 
			var command = [
				GET_EXTENT_SCRIPT_PATH, 	// script
				postgis_db, 	// database name
				file_id,	// table name
			].join(' ');


			// create database in postgis
			exec(command, {maxBuffer: 1024 * 50000}, function (err, stdout, stdin) {

				var json = stdout.split('\n')[2];
				var geojson = JSON.parse(json);
				var area = geojsonArea.geometry(geojson);

				metadata.extent_geojson = geojson;
				metadata.total_area = area; // square meters

				// callback
				callback(null);
			});

		});

		// get number of rows
		ops.push(function (callback) {

			var query = 'SELECT count(*) FROM ' + file_id;

			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback();

				var json = results.rows[0];
				metadata.row_count = json.count;

				callback();
			});
		});


		// get size of table in bytes
		ops.push(function (callback) {

			var query = "SELECT pg_size_pretty(pg_table_size('" + file_id + "'));"
			
			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback();

				var json = results.rows[0];
				metadata.size_bytes = json.pg_size_pretty;

				callback();
			});
		});

		
		// // get histograms
		// ops.push(function (callback) {

		// 	var columns = metadata.columns._columns;
		// 	var histogram = {};

		// 	async.each(columns, function (column, cb) {

		// 		api.postgis.fetchHistogram({
		// 			database_name : postgis_db,
		// 			table_name : file_id, 
		// 			num_buckets : api.config.postgis.filters.num_buckets,
		// 			column : column
		// 		}, function (err, histo) {
		// 			if (err) console.log('hisgto err', err);

		// 			histogram[column] = histo;
		// 			cb(null);
		// 		});


		// 	}, function (err, results) {

		// 		// set histogram to meta
		// 		metadata.histogram = histogram;

		// 		callback();
		// 	})


		// });


		// get geometry type
		ops.push(function (callback) {

			// do sql query on postgis
			var GET_GEOMETRY_TYPE_SCRIPT = '../scripts/postgis/get_geometry_type.sh';

			// st_extent script 
			var command = [
				GET_GEOMETRY_TYPE_SCRIPT, // script
				postgis_db, 	// database name
				file_id,	// table
			].join(' ');


			// do postgis script
			exec(command, {maxBuffer: 1024 * 50000}, function (err, stdout, stdin) {
				if (err) return callback(err);

				var arr = stdout.split('\n'),
				    result = [];

				arr.forEach(function (arrr) {
					try {
						var item = JSON.parse(arrr);
						result.push(item);
					} catch (e) {};
				});

				metadata.geometry_type = result[0].st_geometrytype;

				callback(null, result);

			});
		});

		async.series(ops, function (err, results) {
			done(err, metadata);
		});
	},

	fetchHistogram : function (options, done) {

		var table_name = options.table_name,
		    database_name = options.database_name,
		    num_buckets = options.num_buckets || 50, // todo: move to config
		    column = options.column,
		    ops = [];


		ops.push(function (callback) {

			// do sql query on postgis
			var GET_HISTOGRAM_SCRIPT = '../scripts/postgis/get_histogram.sh';

			// st_extent script 
			var command = [
				GET_HISTOGRAM_SCRIPT, 	// script
				database_name, 	// database name
				table_name,
				column,
				num_buckets
			].join(' ');


			// do postgis script
			exec(command, {maxBuffer: 1024 * 50000}, function (err, stdout, stdin) {
				if (err) return callback(err);

				var arr = stdout.split('\n'),
				    result = [];

				arr.forEach(function (arrr) {
					try {
						var item = JSON.parse(arrr);
						result.push(item);
					} catch (e) {};
				});

				callback(null, result);

			});
		});

		async.waterfall(ops, done);

	},


	_primeTableWithGeometries : function (options, done) {

		var file_id = options.file_id,
		    postgis_db = options.postgis_db,
		    ops = [];

		// get geometry type
		ops.push(function (callback) {
			api.postgis.query({
				postgis_db : postgis_db,
				query : 'SELECT ST_GeometryType(geom) from "' + file_id + '" limit 1'
			}, function (err, results) {
				if (err) return callback(err);
				console.log('results', results);
				if (!results || !results.rows || !results.rows.length) return callback('The dataset contains no valid geodata.');
				var geometry_type = results.rows[0].st_geometrytype.split('ST_')[1];
				callback(null, geometry_type);
			})
		});

		// create geometry 3857
		ops.push(function (geometry_type, callback) {
			var column = ' the_geom_3857';
			var geometry = ' geometry(' + geometry_type + ', 3857)';
			var query = 'ALTER TABLE ' + file_id + ' ADD COLUMN' + column + geometry;

			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback(err);
				callback(null, geometry_type);
			});
		});

		// create geometry 4326
		ops.push(function (geometry_type, callback) {
			var column = ' the_geom_4326';
			var geometry = ' geometry(' + geometry_type + ', 4326)';
			var query = 'ALTER TABLE ' + file_id + ' ADD COLUMN' + column + geometry;

			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback(err);
				callback(err, geometry_type);
			});
		});


		// populate geometry
		ops.push(function (geometry_type, callback) {
			var query = 'ALTER TABLE ' + file_id + ' ALTER COLUMN the_geom_3857 TYPE Geometry(' + geometry_type + ', 3857) USING ST_Transform(geom, 3857)'

   			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback(err);
				callback(err, geometry_type);
			});
		});

		// populate geometry
		ops.push(function (geometry_type, callback) {
			var query = 'ALTER TABLE ' + file_id + ' ALTER COLUMN the_geom_4326 TYPE Geometry(' + geometry_type + ', 4326) USING ST_Transform(geom, 4326)'

   			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback(err);
				callback(err);
			});
		});


		// create index for 3857
		ops.push(function (callback) {
			var idx = file_id + '_the_geom_4326_idx';
			var query = 'CREATE INDEX ' + idx + ' ON ' + file_id + ' USING GIST(the_geom_4326)'

			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback(err);
				callback(null);
			});
		});

		// create index for 4326
		ops.push(function (callback) {
			var idx = file_id + '_the_geom_3857_idx';
			var query = 'CREATE INDEX ' + idx + ' ON ' + file_id + ' USING GIST(the_geom_3857)'

			api.postgis.query({
				postgis_db : postgis_db,
				query : query
			}, function (err, results) {
				if (err) return callback(err);
				callback(null, 'ok');
			});
		});


		async.waterfall(ops, function (err, results) {
			done(err);
		});

	},


	query : function (options, callback) {
		var postgis_db = options.postgis_db,
		    variables = options.variables,
		    query = options.query;

		// count rows and add to uploadStatus
		var conString = 'postgres://docker:docker@postgis/' + postgis_db; // todo: put in config
		pg.connect(conString, function(err, client, pgcb) {
			if (err) return callback(err);
			
			// do query
			client.query(query, variables, function(err, result) {
				// clean up after pg
				pgcb();
				// client.end();

				if (err) return callback(err); 
				
				// return result
				callback(null, result);
			});
		});
	},


	_getGeotype : function (options) {
		var files = options.files,
		    type = false;

		// only one file
		if (files.length == 1) {
			var ext = files[0].split('.').reverse()[0];
			if (ext == 'geojson') return 'geojson';
			if (ext == 'ecw') return 'raster';
			if (ext == 'jp2') return 'raster';
			if (ext == 'tif') return 'raster';
			if (ext == 'tiff') return 'raster';
		}

		// several files
		files.forEach(function (file) {
			var ext = file.split('.').reverse()[0];
			if (ext == 'shp') type = 'shapefile';
		});

		return type;
	},

	_getExtension : function (file) {
		var ext = file.split('.').reverse()[0];
		return ext;
	},


	_getShapefile : function (shapes) {
		var shapefile;
		for (s in shapes) {
			if (shapes[s] && shapes[s].slice(-4) == '.shp') {
				var shapefile = shapes[s];
			}
		}
		return shapefile;
	},


	_getBasefile : function (file) {
		var filename = file.split('/').reverse()[0];
		return filename;
	},

	_getRasterType : function (file) {
		var extension = api.postgis._getExtension(file);
		if (extension == 'ecw') 			return 'ERDAS Compressed Wavelets (ECW)';
		if (extension == 'tif' || extension == 'tiff') 	return 'GeoTIFF';
		if (extension == 'jp2') 			return 'JPEG-2000';

		return 'Unknown';
	},

}