// API: api.auth.js

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


// exports
module.exports = api.auth = { 

	
	forgotPassword : function (req, res) {
		res.render('../../views/forgot.ejs', {message : ''});
	},

	createPassword : function (req, res) {

		console.log('createPassword', req.body);

		// check token
		var token = req.body.token;
		var password = req.body.password;

		api.redis.get(token, function (err, userUuid) {
			if (err || !userUuid) return res.end(JSON.stringify({
				err : err || 'Invalid token'
			}));

			User
			.findOne({uuid : userUuid})
			.exec(function (err, user) {
				api.auth.setPassword(user, password, function (err, doc) {
					res.end(JSON.stringify({
						err : null,
						email : user.local.email
					}));

					// delete temp token
					api.redis.del(token);
				});
			});
		});
	},

	requestPasswordReset : function (req, res) {
		// get email
		var email = req.body.email;

		User
		.findOne({'local.email' : email})
		.exec(function (err, user) {

			var text = 'Please check your email for password reset link.';

			// send password reset email
			if (!err && user) {
				api.email.sendPasswordResetEmail(user);
				res.end(text);
			} else {
				res.end(text);
			}
		});
	},

	checkResetToken : function (req, res) {

		// check token
		var token = req.body.token;
		api.redis.get(token, function (err, userUuid) {
			return res.end(JSON.stringify({
				valid : userUuid ? true : false
			}));
		});
	},

	setPassword : function (user, password, callback) {
		user.local.password = user.generateHash(password);
		user.markModified('local');
		user.save(callback);
	},

	setNewLoginToken : function (user) {
		return this.setPasswordResetToken(user, true);
	},

	setPasswordResetToken : function (user, dontexpire) {
		var token = crypto.randomBytes(20).toString('hex'),
		    key = user.uuid;

		// set temp token
		api.redis.set(token, key);  
		
		// expire in ten mins
		if (!dontexpire) api.redis.expire(token, 600); 

		return token;
	},

}