
// libs
var async 	 = require('async');
var colors 	 = require('colors');
var crypto       = require('crypto');
var uuid 	 = require('node-uuid');
var mongoose 	 = require('mongoose');
var _ 		 = require('lodash');
var fs 		 = require('fs');
var Table 	 = require('easy-table');

// database schemas
var Project 	 = require('../models/project');
var Clientel 	 = require('../models/client');	// weird name cause 'Client' is restricted name
var User  	 = require('../models/user');
var File 	 = require('../models/file');
var Layer 	 = require('../models/layer');
var Hash 	 = require('../models/hash');
var Role 	 = require('../models/role');
var Group 	 = require('../models/group');

// config
var config  = require('../config.js').serverConfig;

// connect to our database
mongoose.connect(config.mongo.url); 


User
.find()
.exec(function (err, users) {

	var t = new Table;

	// console.log(err, users)
	users.forEach(function (u, i) {
		
		// columns
		t.cell('#', i);
		t.cell('Username', u.username);
		t.cell('First Name', u.firstName);
		t.cell('Last Name', u.lastName);
		t.cell('Email', u.local.email);
		t.cell('ID', u.id);
		t.newRow();

	});

	t.sort();
	console.log('\n');
	console.log(t.toString());
	process.exit(0);

});