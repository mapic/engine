var assert = require('assert');
var mongoose = require('mongoose');
var async = require('async');
var fs = require('fs');
var crypto = require('crypto');
var httpStatus = require('http-status');
var path = require('path');
var chai = require('chai');
var expect = chai.expect;
var expected = require('../../shared/errors');
var testData = require('../shared/upload/import_data.json');
var endpoints = require('../endpoints.js');
var helpers = require('../helpers');
var token = helpers.token;
var supertest = require('supertest');
// var api = supertest('https://' + process.env.SYSTEMAPIC_DOMAIN);
var tmp = {};
var Project = require('../../models/project');
var Layer = require('../../models/layer');
var File = require('../../models/file');

// api
var domain = (process.env.MAPIC_DOMAIN == 'localhost') ? 'https://172.17.0.1' : 'https://' + process.env.MAPIC_DOMAIN;
var api = supertest(domain);

module.exports = function () {

    describe('Import', function () {

        before(function(callback) {
            async.series([helpers.create_project], callback);
        });

        after(function(callback) {
            async.series([helpers.delete_project], callback);
        });

        describe(endpoints.import.post, function () {
	        this.slow(500);

	        context('shapefile.missing-prj.zip', function () {
	            this.timeout(21000);
	            
	            it('upload', function (done) {
	                token(function (err, access_token) {
	                    api.post(endpoints.import.post)
		                    .type('form')
		                    .field('access_token', access_token)
		                    .field('data', fs.createReadStream(path.resolve(__dirname, '../open-data/shapefile.missing-prj.zip')))
		                    .expect(httpStatus.OK)
		                    .end(function (err, res) {
		                    	if (err) {
		                    		return done(err);
		                    	}

		                        var result = helpers.parse(res.text);

		                        expect(result.file_id).to.exist;
		                        expect(result.user_id).to.exist;
		                        expect(result.upload_success).to.exist;
		                        expect(result.filename).to.be.equal('shapefile.missing-prj.zip');
		                        expect(result.status).to.be.equal('Processing');

		                        tmp.file_id = result.file_id;
		                        done();
		                    });
	                });
	            });

        	});
		});

    });

    describe('Process', function () {
        this.slow(500);

        it('should be processed', function (done) {
            this.timeout(11000);
            this.slow(5000);

            // check for processing status
            var processingInterval = setInterval(function () {
                process.stdout.write('.');
                token(function (err, access_token) {
                    api.get(endpoints.import.status)
                    .query({ file_id : tmp.file_id, access_token : access_token})
                    .end(function (err, res) {
                    	if (err) {
                    		return done(err);
                    	}

                        var status = helpers.parse(res.text);
                        
                        if (status.status === 'Failed') {
                            clearInterval(processingInterval);
                            done();
                        }
                    });
                });
            }, 500);

        });

        it('should be processed with error', function (done) {
            token(function (err, access_token) {
                api.get(endpoints.import.status)
                .query({file_id : tmp.file_id, access_token : access_token})
                .expect(httpStatus.OK)
                .end(function (err, res) {
                	if (err) {
                		return done(err);
                	}

                    var status = helpers.parse(res.text);

                    expect(status.upload_success).to.exist;
                    expect(status.status).to.be.equal('Failed');
                    expect(status.error_text).to.be.equal('Please provide a projection file.');
                    expect(status.user_id).to.be.equal(helpers.test_user.uuid);
                    done();
                });
            })
        });

    });

};