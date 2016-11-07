var supertest = require('supertest');
var chai = require('chai');
var expect = chai.expect;
// var api = supertest('https://' + process.env.SYSTEMAPIC_DOMAIN);
var helpers = require('../helpers');
var token = helpers.token;
var httpStatus = require('http-status');
var expected = require('../../shared/errors');
var Hash = require('../../models/hash');
var Project = require('../../models/project');
var endpoints = require('../endpoints.js');

// api
var domain = (process.env.MAPIC_DOMAIN == 'localhost') ? 'https://172.17.0.1' : 'https://' + process.env.MAPIC_DOMAIN;
var api = supertest(domain);

// Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs
// See https://github.com/systemapic/pile/issues/38
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

module.exports = function () {

	describe(endpoints.hashes.get, function () {
		tmpHash = {}

		before(function (done) {
	        var hash = new Hash();

	        hash.uuid = 'test_mocha_hash';
	        hash.project = 'some project id';
	        hash.id = 'some hash id';

	        hash.save(function (err, _hash) {
	        		if (err) {
	        			return done(err);
	        		}

	        		tmpHash = _hash;

	        		done();
	        	});
		});

		after(function (done) {
	        Hash.findOne({uuid: tmpHash.uuid})
	            .remove()
	            .exec(done);
		});

        it("should respond with status code 401 when not authenticated", function (done) {
            api.get(endpoints.hashes.get)
                .send()
                .expect(httpStatus.UNAUTHORIZED)
                .end(done);
        });

        it('should respond with status code 400 and specific error message if id and project_id don\'t exist in request body', function (done) {
            token(function (err, access_token) {
                api.get(endpoints.hashes.get)
                    .query({
                        access_token: access_token
                    })
                    .send()
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);
                        expect(result.error.message).to.be.equal(expected.missing_information.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.BAD_REQUEST);
                        expect(result.error.errors.missingRequiredFields).to.be.an.array;
                        expect(result.error.errors.missingRequiredFields).to.include('project_id');
                        expect(result.error.errors.missingRequiredFields).to.include('id');
                        done();
                    });
            });
        });

        it('should respond with status code 400 and specific error message if id and project_id don\'t exist in request body', function (done) {
            token(function (err, access_token) {
                api.get(endpoints.hashes.get)
                    .query({
                        access_token: access_token,
                        project_id: 'some_project_id',
                        id: 'some_id'
                    })
                    .send()
                    .expect(httpStatus.NOT_FOUND)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);
                        expect(result.error.message).to.be.equal(expected.no_such_hash.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.NOT_FOUND);
                        done();
                    });
            });
        });

        it('should respond with status code 200', function (done) {
            token(function (err, access_token) {
                api.get(endpoints.hashes.get)
                    .query({
                        access_token: access_token,
                        project_id: tmpHash.project,
                        id: tmpHash.id
                    })
                    .send()
                    .expect(httpStatus.OK)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);
                        expect(result.error).to.be.null;
                        expect(result.hash.uuid).to.be.equal(tmpHash.uuid);
                        expect(result.hash.project).to.be.equal(tmpHash.project);
                        expect(result.hash.id).to.be.equal(tmpHash.id);
                        done();
                    });
            });
        });

	});

};