// API: api.analytics.js

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
var nodeSlack 	= require('node-slack');
var crypto      = require('crypto');
var fspath 	= require('path');
var mapnik 	= require('mapnik');
var request 	= require('request');
var ogr2ogr 	= require('ogr2ogr');
var nodepath    = require('path');
var formidable  = require('formidable');
var nodemailer  = require('nodemailer');
var ua 		= require('universal-analytics');
var uploadProgress = require('node-upload-progress');
var mapnikOmnivore = require('mapnik-omnivore');

// api
var api = module.parent.exports;

// exports
module.exports = api.analytics = { 

	set : function (req, res) {
		console.time('ga set');
		var options = req.body;
		console.log('ga set options'.red, options);
		// called from routes.js:64, /api/analytics/set

		if (!options) return api.error.missingInformation(req, res);

		// node module: https://www.npmjs.com/package/universal-analytics

		// Measurement Protocol Developer Guide:
		// https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide
		
		// Full API
		// https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters

		// Validate request
	 	var _error = this.validate(options);

	 	// INVALID REQIEST
	 	if ( _error ) {	 		

			// return to client
			res.end(JSON.stringify({
				result : _error,
				error : true
			}));

			return;	 		
	 	}


		var userHeader  = options.userHeader;
		var gaEvent 	= options.gaEvent;
		var gaPageview  = options.gaPageview;


		var trackingID = userHeader.trackingID;
		var clientID   = userHeader.clientID;   // The same as user id

		// Create GA user instance
		console.time('gaInstance');
		var visitor = ua(trackingID, clientID, {
		

			// This is because we're not using
			// GOOGLE's preferred format
			strictCidFormat: false

		});
		console.timeEnd('gaInstance');

		// TRACKING PAGEVIEWS
		if ( gaPageview ) {

			// OPTIONS
			var pageviewParams = { 

				// PAGE: whatever comes after domain name, i.e. "client/project"
				dp: gaPageview.page, 

				// TITLE: name of page (project name)
				dt: gaPageview.title, 

				// HOSTNAME: url of portal (i.e. maps.systemapic.com)
				dh: gaPageview.hostname,

				// Project ID: dimension1
				cd1: gaPageview.dimension1,

				// Client ID: dimension4
				cd4: gaPageview.dimension4,

				// Project name: dimension6
				cd6: gaPageview.dimension6,

				// Client name: dimension7
				cd7: gaPageview.dimension7,
				
				// User full name (Session)
				cd2: gaPageview.dimension2,
				
				// Software version (Session)
				cd3: gaPageview.version

			}

			console.time('pageview');
			visitor.pageview(pageviewParams, function (err) {
			console.timeEnd('pageview');

				// return to client
				res.end(JSON.stringify({
					result : 'GA PAGEVIEW OK',
					error : false
				}));

			});

		}			



		// TRACKING EVENTS
		
		if ( gaEvent ) {

			// OPTIONS
			var eventParams = {

				// category (required)
				ec: gaEvent.eventCategory,

				// action (required)
				ea: gaEvent.eventAction,

				// path (optional)
				dp: gaEvent.path

			}

			// Label
			if ( gaEvent.eventLabel ) eventParams.el = gaEvent.eventLabel;

			// Value
			if ( gaEvent.eventValue ) eventParams.ev = gaEvent.eventValue;	


			// visitor.event(eventParams).send();
			console.time('pageevent');
			visitor.event(eventParams, function (err) {
			console.timeEnd('pageevent');
				
				// return to client
				res.end(JSON.stringify({
					result : 'GA EVENT OK',
					error : false
				}));

			});

		}

		console.timeEnd('ga set');


	},

	validate : function(options) {

		var userHeader  = options.userHeader;
		var gaEvent 	= options.gaEvent;
		var gaPageview  = options.gaPageview;

		if ( !userHeader ) 			return { error : 'missing header (should contain trackingID and clientID' };			

		if ( !userHeader.trackingID ) 		return { error : 'missing trackingID' };
		if ( !userHeader.clientID)		return { error : 'missing clientID' };

		if ( !gaEvent && !gaPageview)		return { error : 'no event or pageview to track' };
		if ( gaEvent  && gaPageview)		return { error : 'cannot track pageview and event in the same request' };

		if ( gaEvent ) {

			if ( !gaEvent.eventCategory ) 	return { error : 'missing event category' };
			if ( !gaEvent.eventAction )   	return { error : 'missing event action' };
			if ( !gaEvent.path )		return { error : 'missing event path' };
		
		}

		if ( gaPageview ) {
		
			if ( !gaPageview.page )		return { error : 'missing "page" in pageview tracking' };
			if ( !gaPageview.title )	return { error : 'missing "title" in pageview tracking' };
			if ( !gaPageview.hostname )	return { error : 'missing "hostname" in pageview tracking' };
			if ( !gaPageview.dimension1 )	return { error : 'missing "dimension1" in pageview tracking' };
			if ( !gaPageview.dimension4 )	return { error : 'missing "dimension4" in pageview tracking' };
			if ( !gaPageview.dimension6 )	return { error : 'missing "dimension6" in pageview tracking' };
			if ( !gaPageview.dimension7 )	return { error : 'missing "dimension7" in pageview tracking' };
			if ( !gaPageview.dimension2 )	return { error : 'missing "dimension2" in pageview tracking' };
			if ( !gaPageview.version )	return { error : 'missing "version" in pageview tracking' };
		
		}

		return false;


	},


	// NOT IN USE YET
	get : function (req, res) {

		var options = req.body;
		// called from routes.js:64, /api/analytics/get

		if (!options) return api.error.missingInformation(req, res);

		// return to client
		res.end(JSON.stringify({
			result : 'lol',
			error : false
		}));
	}


}



