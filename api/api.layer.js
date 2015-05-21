// API: api.layer.js

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


// api
var api = module.parent.exports;

console.log('lauyer');

// exports
module.exports = api.layer = { 


	// create layer
	create : function (req, res) {

		// lol?
		return res.end(JSON.stringify({error : 'Unsupported.'}))

		// var layerType = req.body.layerType;

		// if (layerType == 'geojson') return api.layer.createLayerFromGeoJSON(req, res);

		// res.end(JSON.stringify({
		// 	layer : 'yo!'
		// }));

	},

	// create OSM layer
	createOSM : function (req, res) {

		var projectUuid = req.body.projectUuid;
		var title = req.body.title;

		var layer 		= new Layer();
		layer.uuid 		= 'osm-layer-' + uuid.v4();
		layer.title 		= title;
		layer.description 	= 'Styleable vector tiles';
		layer.data.osm 	 	= true;
		layer.legend 		= '';
		layer.file 		= 'osm';

		layer.save(function (err, doc) {
			if (err || !doc) return api.error.general(req, res, err || "Couldn't create layer.");

			// return layer to client
			res.end(JSON.stringify(doc));

			// add to project
			doc && api.layer.addToProject(doc._id, projectUuid);
		});
	},


	// create layer from geojson
	createLayerFromGeoJSON : function (req, res) {
		var geojson = req.body.geojson,
		    projectUuid = req.body.project,
		    filename = uuid.v4() + '.geojson',
		    outfile = '/tmp/' + filename,
		    data = JSON.stringify(geojson),
		    size = data.length;

		fs.writeFile(outfile, data, function (err) {
			if (err) return api.error.general(req, res, err);

			var file = [{ 
				fieldName : 'file[]',
				originalFilename : filename,
				path : outfile,
				size : size || 0,
				name : 'Created Shape',
				type : 'application/octet-stream' 
			}];

			req.files = {
				file : file
			}

			// upload.upload(req, res);
			api.upload.file(req, res);
		});
	},


	// get layers and send to client
	get : function (req, res) {
		var project = req.body.project,
		    user = req.user.uuid;

		// error if no project or user
		if (!project || !user) return api.error.missingInformation(req, res);

		// get project
		Project.find({ 'access.read' : user, 'uuid' : project }, function(err, result) { 
			if (err || !result) api.error.general(req, res, err);

			// got project
			Layer.find({ 'uuid': { $in: result.layers }}, function(err, docs){
				if (err || !docs) api.error.general(req, res, err);
				
				// return layers
				res.end(JSON.stringify(docs));
			});
		});
	},


	// update layer
	update : function (req, res) {

		var layerUuid 	= req.body.layer || false;
		var user 	= req.user;
		
		// error if no project or user
		if (!layerUuid) return api.error.missingInformation(req, res);


		Layer.findOne({'uuid' : layerUuid}, function (err, layer) {
			if (err || !layer) return api.error.missingInformation(req, res);

			// update description
			if (req.body.hasOwnProperty('description')) {
				var description = req.body.description;
				layer.description = description;
				layer.save();
			};

			// update description
			if (req.body.hasOwnProperty('copyright')) {
				var copyright = req.body.copyright;
				layer.copyright = copyright;
				layer.save();
			};

			// update title
			if (req.body.hasOwnProperty('title')) {
				var title = req.body.title;
				layer.title = title;
				layer.save();
			};

			// update tooltip
			if (req.body.hasOwnProperty('tooltip')) {
				var tooltip = req.body.tooltip;
				layer.tooltip = tooltip;
				layer.save();
			}

			// update legends
			if (req.body.hasOwnProperty('legends')) {
				var legends = req.body.legends;
				layer.legends = legends;
				layer.save();
			}

			// update zIndex
			if (req.body.hasOwnProperty('zIndex')) {
				var zIndex = req.body.zIndex;
				layer.zIndex = zIndex;
				layer.save();
			}

			res.end('save done');
		});

	},


	deleteLayer : function (req, res) {

		var projectUuid  = req.body.projectUuid,
		    userid = req.user.uuid,
		    layerUuids = req.body.layerUuids,
		    ops = [],
		    _lids = [];

		// validate
		if (!projectUuid || !userid) return api.error.missingInformation(req, res);

		// find layer _ids for removing in project
		ops.push(function (callback) {
			Layer.find({uuid : {$in : layerUuids}}, function (err, layers) {
				if (err || !layers) return callback(err || 'No layers.');

				layers.forEach(function (layer) {
					_lids.push(layer._id);
				});

				callback(err);
			});
		});



		// delete layer from project
		ops.push(function (callback) {
			
			Project
			.findOne({uuid : projectUuid})
			.exec(function (err, project) {
				if (err || !project) return callback(err || 'No project.');

				// pull layers
				_lids.forEach(function (l) {
					project.layers.pull(l)
				})
				
				// project.markModified('files');
				project.markModified('layers');
				project.save(function (err) {
					callback(err);
				});
			});
		});

	
		// run queries
		async.series(ops, function(err) {
			if (err) return api.error.general(req, res, err);		

			res.end(JSON.stringify({
				error : err
			}));
		});

	},


	// reload layer meta
	reloadMeta : function (req, res) {
		var fileUuid = req.body.fileUuid;
		var layerUuid = req.body.layerUuid;

		// return on err
		if (!fileUuid || !layerUuid) return api.error.missingInformation(req, res);

		// get meta
		api.layer.getMeta(fileUuid, function (err, meta) {

			// return on err
			if (err || !meta) return api.error.general(req, res, err || 'No meta.');

			// save meta to fil
			api.layer.setMeta(meta, layerUuid, function (err, result) {

				// return meta
				res.end(JSON.stringify({
					error : err,
					meta : meta
				}));
			});
		});
	},


	// get layer meta
	getMeta : function (fileUuid, callback) {

		File
		.findOne({uuid : fileUuid})
		.exec(function (err, file) {
			if (err || !file) return callback(err || 'No file.');

			// only support for geojson now
			if (!file.data || !file.data.geojson) return callback({error : 'No geojson found.'});

			// set path
			var path = api.config.path.file + fileUuid + '/' + file.data.geojson;

			// var omnipath = METAPATH + uuid + '.meta.json';
			fs.readJson(path, function (err, metadata) { 			// expensive
				callback(err, metadata);
			});			
		});
	},


	// set layer meta
	setMeta : function (meta, layerUuid, callback) {

		Layer
		.findOne({uuid : layerUuid})
		.exec(function (err, layer) {
			if (err || !layer) return callback(err || 'No layer.');

			layer.metadata = meta; 	// string?
			layer.save(function (err) {
				callback(err);
			});
		});
	},

	// get cartocss
	getCartoCSS : function (req, res) {
		var cartoId = req.body.cartoid;
		var path = api.config.path.cartocss + cartoId + '.mss';
		fs.readFile(path, {encoding : 'utf8'}, function (err, data) {
			if (err || !data) return api.error.general(req, res, err || 'No data.');

			res.end(data);
		});
	},

	// set carto css
	setCartoCSS : function (req, res) {

		console.log('setCartoCSS!'.yellow);

		// get params
		var fileUuid 	= req.body.fileUuid,
		    css 	= req.body.css,
		    cartoid 	= req.body.cartoid,
		    layerUuid 	= req.body.layerUuid,
		    csspath = api.config.path.cartocss + cartoid + '.mss',
		    isOSM = (fileUuid == 'osm'),
		    host = isOSM ? api.config.vileosm.uri : api.config.vile.uri;

		var host = api.config.vile.uri;

		console.log('host: ', host);

		// save css to file by cartoId 
		fs.writeFile(csspath, css, {encoding : 'utf8'}, function (err) {
			console.log('write err?', err);
			if (err) return api.error.general(req, res);

			// send to tileserver storage
			request({
				method : 'POST',
				uri : host + 'import/cartocss',
				json : {
					css : css,
					cartoid : cartoid,
					osm : (fileUuid == 'osm')
				}
			}, 

			// callback
			function (err, response, body) {
				console.log('err', err);

				// custom error handling
				if (err) {
					return res.end(JSON.stringify({
		        			ok : false,
		        			error : err
		        		}));
				}
				// pass syntax errors to client
		        	if (!body.ok) {
		        		return res.end(JSON.stringify({
		        			ok : false,
		        			error : body.error
		        		}));
		        	}

		        	if (!err && response.statusCode == 200) {
				
					Layer
					.findOne({uuid : layerUuid})
					.exec(function (err, layer) {
						if (err || !layer) return api.error.general(req, res, err || 'No layer.');

						layer.data.cartoid = cartoid;
						layer.markModified('data');
						
						layer.save(function (err, doc) {
							if (err || !doc) return api.error.general(req, res, err || 'No layer.');

							res.end(JSON.stringify({
				        			ok : true,
				        			cartoid : cartoid,
				        			error : null			// todo: save err
				        		}));
						});
					});

		        	} else {
		        		return api.error.general(req, res, 'setCartoCss !200');
		        	}
			});
		});
	},


	


	

	_inheritDefinitions : function (definitions, env) {
		
		try {
			var inheritTime = +new Date();
			// definitions are ordered by specificity,
			// high (index 0) to low
			var byAttachment = {},
			byFilter = {};
			var result = [];
			var current, previous, attachment;

			// Evaluate the filters specified by each definition with the given
			// environment to correctly resolve variable references
			definitions.forEach(function(d) {
				d.filters.ev(env);
			});

			for (var i = 0; i < definitions.length; i++) {

				attachment = definitions[i].attachment;
				current = [definitions[i]];

				if (!byAttachment[attachment]) {
					byAttachment[attachment] = [];
					byAttachment[attachment].attachment = attachment;
					byFilter[attachment] = {};
					result.push(byAttachment[attachment]);
				}

				// Iterate over all subsequent rules.
				for (var j = i + 1; j < definitions.length; j++) {
					if (definitions[j].attachment === attachment) {
						// Only inherit rules from the same attachment.
						current = addRules(current, definitions[j], byFilter[attachment], env);
					}
				}

				for (var k = 0; k < current.length; k++) {
					byFilter[attachment][current[k].filters] = current[k];
					byAttachment[attachment].push(current[k]);
				}
			}

			return result;
		} catch (e) {
			return [];
		}

	},


	createModel : function (options, callback) {
		console.log('api.layer.createModel'.yellow, options);

		var layer 		= new Layer();
		layer.uuid 		= options.uuid;
		layer.title 		= options.title;
		layer.description 	= options.description || '';
		layer.legend 		= options.legend || '';
		layer.file 		= options.file;
		layer.metadata 		= options.metadata;

		if (options.data.geojson) layer.data.geojson = options.data.geojson;
		if (options.data.raster)  layer.data.raster  = options.data.raster;

		layer.save(function (err, doc) {
			callback && callback(err, doc);
		});
	},

	// save file to project (file, layer, project id's)
	addToProject : function (layer_id, projectUuid, callback) {
		Project
		.findOne({'uuid' : projectUuid })
		.exec(function (err, project) {
			if (err || !project) return callback(err || 'No project.');

			project.layers.push(layer_id);			
			project.markModified('layers');
			project.save(function (err) {
				callback && callback(err);
			});
		});
	},
}

// systemapic hack
carto.Renderer.prototype.getRules = function render(data) {
	var env = _(this.env).defaults({
		benchmark: true,
		validation_data: false,
		effects: []
	});

	carto.tree.Reference.setVersion(this.options.mapnik_version);

	var parser = (carto.Parser(env)).parse(data);

	return parser;
}

