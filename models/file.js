// app/models/user.js
// load the things we need
var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var timestamps = require('mongoose-times');


// define the schema for our file model
var fileSchema = mongoose.Schema({

	uuid            : String,
	family          : String,       // uuid of family - ie. versions of same file
	createdBy       : String,
	createdByName   : String, 
	files           : [String],
	folder          : String,
	absfolder       : String,
	name            : String,
	originalName 	: String,
	description     : String,
	copyright 		: String,
	keywords        : [String],
	category        : String,
	version         : Number,        
	status          : String,        // current, archived, etc...
	type            : String,
	format          : [String],       // .shp, .kml, .zip, .jpg
   	styleTemplates  : [String], // array of JSON

	data : {

		postgis : { 				// postgis data
			database_name : String,
			table_name : String,
			data_type : String, 		// raster or vector
			original_format : String, 	// GeoTIFF, etc.
			metadata : String,
			file_id : String
		}, 	

		// todo: clean this up!
		image : {
			file : String, 
			dimensions  : {
				width : Number,
				height : Number
			},
			created : String,
			gps : {
				lat : Number,
				lng : Number,
				alt : Number,
				dir : Number
			},
			orientation : Number,
			crunched : [{
				file : String, 
				width : Number,
				height : Number,
				quality : Number,
				crop : {
					w : Number,
					h : Number,
					x : Number,
					y : Number
				}
			}]
		}
	},

	dataSize : String,              // datasize in bytes, for progress bar

	access : {                      // list of users/projects/clients that can use (RW) this file
		users   : [String],
		projects: [String],
		clients : [String]
	},
});

// timestamps plugin
fileSchema.plugin(timestamps);   // adds created and lastUpdated fields automatically

// create the model for users and expose it to our app
module.exports = mongoose.model('File', fileSchema);