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

    describe('Raster GeoTIFF (snow)', function () {

        before(function(callback) {
            async.series([helpers.create_project], callback);
        });

        after(function(callback) {
            async.series([helpers.delete_project], callback);
        });

        this.slow(1000);
        this.timeout(21000);

        it('should upload', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.import.post)
                .type('form')
                .field('access_token', access_token)
                .field('data', fs.createReadStream(path.resolve(__dirname, '../open-data/snow.raster.200.tif')))
                .expect(httpStatus.OK)
                .end(function (err, res) {
                    if (err) return done(err);
                    var result = helpers.parse(res.text);
                    expect(result.file_id).to.exist;
                    expect(result.user_id).to.exist;
                    expect(result.upload_success).to.exist;
                    expect(result.filename).to.be.equal('snow.raster.200.tif');
                    expect(result.status).to.be.equal('Processing');
                    tmp.file_id = result.file_id;
                    done();
                });
            });
        });

        it('should get status', function (done) {
            token(function (err, access_token) {
                api.get(endpoints.import.status)
                .query({file_id : tmp.file_id, access_token : access_token})
                .expect(httpStatus.OK)
                .end(function (err, res) {
                    if (err) return done(err);
                    var result = helpers.parse(res.text);
                    expect(result.file_id).to.exist;
                    expect(result.user_id).to.exist;
                    expect(result.upload_success).to.exist;
                    expect(result.upload_success).to.be.true;
                    expect(result.filename).to.be.equal('snow.raster.200.tif');
                    expect(result.status).to.be.equal('Processing');
                    done();
                });
            });
        });


        it('should be processed', function (done) {
            this.timeout(210000);
            this.slow(5000);

            // check for processing status
            token(function (err, access_token) {
                var processingInterval = setInterval(function () {
                    api.get(endpoints.import.status)
                    .query({ file_id : tmp.file_id, access_token : access_token})
                    .end(function (err, res) {
                        if (err) return done(err);
                        var status = helpers.parse(res.text);
                        if (status.processing_success) {
                            clearInterval(processingInterval);
                            done();
                        }
                    });
                }, 500);
            });

        });

        it('should be processed without errors', function (done) {
            token(function (err, access_token) {
                api.get(endpoints.import.status)
                .query({file_id : tmp.file_id, access_token : access_token})
                .expect(httpStatus.OK)
                .end(function (err, res) {
                    if (err) return done(err);
                    var status = helpers.parse(res.text);
                    expect(status.upload_success).to.exist;
                    expect(status.status).to.be.equal('Done');
                    expect(status.filename).to.be.equal('snow.raster.200.tif');
                    expect(status.error_code).to.be.null;
                    expect(status.error_text).to.be.null;
                    done();
                });
            })
        });

        it("200 & download as file", function (done) {
            token(function (err, access_token) {
                api.get(endpoints.import.download)
                .query({file_id: tmp.file_id, access_token: access_token})
                .expect(httpStatus.OK)
                .end(function (err, res) {
                    if (err) return done(err);
                    var result = helpers.parse(res.text);
                    expect(result.file.type).to.be.equal('postgis');
                    expect(result.file.originalName).to.be.equal('snow.raster.200.tif');
                    expect(result.file.name).to.be.equal('snow.raster.200');
                    done();
                });
            });
        });

    });

    describe('Cleanup', function () {
        this.slow(500);
        
        var relatedLayer = testData.relatedLayer;
        var relatedProject = testData.relatedProject;

        before(function (done) {
            var ops = [];
            ops.push(function (callback) {
                relatedLayer.data = {
                    postgis: { table_name: tmp.file_id }
                };
                helpers.create_layer_by_parameters(relatedLayer, function (err, res) {
                    if (err) return callback(err);
                    relatedLayer = res;
                    callback(null, relatedLayer);
                });
            });
            ops.push(function (options, callback) {
                relatedProject.layers = [options];
                helpers.create_project_by_info(relatedProject, function (err, res) {
                    if (err) return callback(err);
                    relatedProject = res;
                    callback(null, relatedProject);
                });
            });
            async.waterfall(ops, done);
        });

        after(function (done) {
            var ops = [];
            ops.push(function (callback) {
                helpers.delete_project_by_id(relatedProject.uuid, callback);
            });
            ops.push(function (options, callback) {
                helpers.delete_layer_by_id(relatedLayer.uuid, callback);
            });
            async.waterfall(ops, done);     
        });

        it('should delete file', function (done) {
            var ops = [];

            ops.push(function (callback) {
                token(function (err, access_token) {
                    api.post(endpoints.data.delete)
                    .send({file_id : tmp.file_id, access_token : access_token})
                    .expect(httpStatus.OK)
                    .end(function (err, res) {
                        if (err) return callback(err);
                        var result = helpers.parse(res.text);
                        expect(result.success).to.be.true;
                        callback(null, result);
                    });
                });
            });

            ops.push(function (options, callback) {
                Project.findOne({uuid: relatedProject.uuid})
                .exec(function (err, updatedProject) {
                    if (err) return callback(err);
                    expect(updatedProject.layers).to.be.empty;
                    callback(null, updatedProject);
                });
            });

            ops.push(function (options, callback) {
                Layer.find({uuid: relatedLayer.uuid})
                .exec(function (err, updatedLayer) {
                    if (err) return callback(err);
                    expect(updatedLayer).to.be.empty;
                    callback(null, updatedLayer);
                });
            });

            ops.push(function (options, callback) {
                File.find({uuid: tmp.file_id})
                .exec(function (err, result) {
                    if (err) return callback(err);
                    expect(result).to.be.empty;
                    callback(null, result);
                });
            });

            async.waterfall(ops, done); 

        });

    });

};