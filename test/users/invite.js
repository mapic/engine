var supertest = require('supertest');
var chai = require('chai');
var expect = chai.expect;
// var api = supertest('https://' + process.env.SYSTEMAPIC_DOMAIN);
var helpers = require('../helpers');
var token = helpers.token;
var httpStatus = require('http-status');
var expected = require('../../shared/errors');
var endpoints = require('../endpoints.js');

// api
var domain = (process.env.MAPIC_DOMAIN == 'localhost') ? 'https://172.17.0.1' : 'https://' + process.env.MAPIC_DOMAIN;
var api = supertest(domain);

module.exports = function () {

    describe(endpoints.users.invite.invite, function () {

	    it('should respond with status code 401 when not authenticated', function (done) {
	        api.post(endpoints.users.invite.invite)
	            .send({})
	            .expect(httpStatus.UNAUTHORIZED)
	            .end(done);
	    });
	
        it('should respond with status code 400 when emails or access don\'t exist in request body', function (done) {
            token(function (err, access_token) {
                if (err) {
                    return done(err);
                }
                
				api.post(endpoints.users.invite.invite)
	                .send({
                        access_token: access_token
                    })
	                .expect(httpStatus.BAD_REQUEST)
	                .end(function (err, res) {
	                	if (err) {
	                		return done(err);
	                	}

                        var result = helpers.parse(res.text);

                        expect(result.error.message).to.be.equal(expected.missing_information.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.BAD_REQUEST);
                        expect(result.error.errors.missingRequiredFields).to.include('emails');
                        expect(result.error.errors.missingRequiredFields).to.include('access');
                        expect(result.error.errors.missingRequiredFields).to.include('access.edit');
                        expect(result.error.errors.missingRequiredFields).to.include('access.read');
                        done();
	                });
            });
        });

        it('should respond with status code 400 when emails array is empty', function (done) {
            token(function (err, access_token) {
                if (err) {
                    return done(err);
                }
                
                api.post(endpoints.users.invite.invite)
                    .send({
                        emails: [],
                        customMessage: 'test customMessage',
                        access: {
                            read: [],
                            edit: []
                        },
                        access_token: access_token
                    })
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);

                        expect(result.error.message).to.be.equal(expected.missing_information.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.BAD_REQUEST);
                        expect(result.error.errors.missingRequiredFields).to.include('emails');
                        done();
                    });
            });
        });

        it('should respond with status code 400 when access object does not contain read and edit arrays', function (done) {
            token(function (err, access_token) {
                if (err) {
                    return done(err);
                }
                
                api.post(endpoints.users.invite.invite)
                    .send({
                        emails: [helpers.test_user.email],
                        customMessage: 'test customMessage',
                        access: {},
                        access_token: access_token
                    })
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);

                        expect(result.error.message).to.be.equal(expected.missing_information.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.BAD_REQUEST);
                        expect(result.error.errors.missingRequiredFields).to.include('access.edit');
                        expect(result.error.errors.missingRequiredFields).to.include('access.read');
                        done();
                    });
            });
        });

        it('should respond with status code 200', function (done) {
            token(function (err, access_token) {
                if (err) {
                    return done(err);
                }
                
                api.post(endpoints.users.invite.invite)
                    .send({
                        emails: [helpers.test_user.email],
                        customMessage: 'test customMessage',
                        access: {
                            read: [],
                            edit: []
                        },
                        access_token: access_token
                    })
                    .expect(httpStatus.OK)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);

                        expect(result.error).to.be.null;
                        done();
                    });
            });
        });

	});

};