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
var _ 		= require('lodash');
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
var request 	= require('request');
var nodepath    = require('path');
var formidable  = require('formidable');
var nodemailer  = require('nodemailer');
var uploadProgress = require('node-upload-progress');
var mapnikOmnivore = require('mapnik-omnivore');
var errors = require('../shared/errors');
var httpStatus = require('http-status');

// api
var api = module.parent.exports;


// exports
module.exports = api.auth = { 

	forgotPassword : function (req, res) {
		console.log('Forgot password', req.body);

		// get email
		var email = req.body.email;

		User
		.findOne({'local.email' : email})
		.exec(function (err, user) {
			if (err || !user) return;

			api.email.sendPasswordResetEmail(user);
		});

		res.send();
	},

	serveResetPage : function (req, res) {
		res.render('../../views/reset.ejs');
	},

	resetPassword : function (req, res, next) {

		// check token
		var params = req.body || {};
		var token = params.token;
		var password = params.password;
		var missingRequiredFields = [];

		console.log('params:', params);

		if (!token) {
			missingRequiredFields.push('token');
		}

		if (!password) {
			missingRequiredFields.push('password');
		}

		if (!_.isEmpty(missingRequiredFields)) {
			return next(api.error.code.missingRequiredRequestFields(errors.missing_information.errorMessage, missingRequiredFields));
		}

		api.redis.temp.get(token, function (err, userUuid) {
			if (err || !userUuid) {
				return next({
					message: errors.invalid_token.errorMessage,
					code: httpStatus.UNAUTHORIZED
				});
			}

			User
			.findOne({uuid : userUuid})
			.exec(function (err, user) {
				if (err || !user) {
					return next({
						message: errors.no_such_user,
						code: httpStatus.NOT_FOUND
					});
				}

				api.auth.setPassword(user, password, function (err, doc) {
					var options = {
						email: user.username,
						password: password
					};

					api.token._get_token_from_password(options, function (err, tokens) {
						if (err) {
							return next({
								message: err.message,
								code: httpStatus.UNAUTHORIZED
							});
						}

						// update cookie
						req.session.tokens = api.utils.parse(tokens);

						// send to login page
						res.redirect('/');

						// delete temp token
						if (token) {
							api.redis.temp.del(token);
						}						
					});
				});
			});
		});
	},

	requestPasswordReset : function (req, res, next) {
		// get email
		var params = req.body || {}; 
		var email = params.email;

		if (!email) {
			return next(api.error.code.missingRequiredRequestFields(errors.missing_information.errorMessage, ['email']));
		}

		User
		.findOne({'local.email' : email})
		.exec(function (err, user) {
			if (!user) {
				return next ({
					message: errors.no_such_user.errorMessage,
					code: httpStatus.NOT_FOUND
				});
			}

			var text = 'Please check your email for password reset link.';

			// send password reset email
			if (!err && user) api.email.sendPasswordResetEmail(user);
			
			res.send(text);
		});
	},

	checkResetToken : function (req, res) {

		// check token
		var token = req.body.token;
		api.redis.temp.get(token, function (err, userUuid) {
			return res.send({
				valid : userUuid ? true : false
			});
		});
	},

	setPassword : function (user, password, callback) {
		user.local.password = user.generateHash(password);
		user.markModified('local');
		user.save(callback);
	},

	setNewLoginToken : function (user) {
		return api.auth.setPasswordResetToken(user, true);
	},

	setPasswordResetToken : function (user, dontexpire) {
		var token = crypto.randomBytes(20).toString('hex'),
		    key = user.uuid;

		// set temp token
		api.redis.temp.set(token, key);  
		
		// expire in ten mins
		if (!dontexpire) api.redis.temp.expire(token, 3600); 

		return token;
	}

};