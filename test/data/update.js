var supertest = require('supertest');
var chai = require('chai');
var expect = chai.expect;
// var api = supertest('https://' + process.env.SYSTEMAPIC_DOMAIN);
var helpers = require('../helpers');
var token = helpers.token;
var expected = require('../../shared/errors');
var httpStatus = require('http-status');
var endpoints = require('../endpoints.js');
var testFile = helpers.test_file;
var coreTestData = require('../shared/core.json');
var second_test_user = coreTestData.secondTestUser;

// api
var domain = (process.env.MAPIC_DOMAIN == 'localhost') ? 'https://172.17.0.1' : 'https://' + process.env.MAPIC_DOMAIN;
var api = supertest(domain);

// Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs
// See https://github.com/systemapic/pile/issues/38
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

module.exports = function () {
    describe(endpoints.data.update, function () {
        this.slow(500);

        
        // prepare & cleanup
        before(function (done) { helpers.create_user_by_parameters(second_test_user, done); });
        after(function (done) { helpers.delete_user_by_id(second_test_user.uuid, done); });

        // test 1
        it('should respond with status code 401 when not authenticated', function (done) {
            api.post(endpoints.data.update)
                .send({})
                .expect(httpStatus.UNAUTHORIZED, {
                    error: {
                        code: httpStatus.UNAUTHORIZED, 
                        message: expected.invalid_token.errorMessage
                    }
                })
                .end(done);
        });



        // test 2
        it('should respond with status code 400 if fileUuid doesn\'t exist in request body', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.data.update)
                    .send({access_token: access_token})
                    .expect(httpStatus.BAD_REQUEST, helpers.createExpectedError(expected.missing_information.errorMessage))
                    .end(done);
            });
        });



        // test 3
        it('should respond with status code 404 and error if file doesn\'t exist', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.data.update)
                    .send({
                        uuid: "invalid file id",
                        access_token: access_token
                    })
                    .expect(httpStatus.NOT_FOUND)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);

                        expect(result.error.message).to.be.equal(expected.no_such_file.errorMessage);
                        done();
                    });
            });
        });



        // test 4
        it('should respond with status code 400 and error if not authenticated', function (done) {
            helpers.users_token(second_test_user, function (err, access_token) {
                api.post(endpoints.data.update)
                    .send({
                        uuid: testFile.uuid,
                        access_token: access_token
                    })
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);

                        expect(result.error.message).to.be.equal(expected.no_access.errorMessage);
                        done();
                    });
            });
        });



        // test 5
        it('should respond with status code 200 and update file correctly', function (done) {
            helpers.token(function (err, access_token) {
                var options = require('../shared/data/update.json').updateData;

                options.uuid =  testFile.uuid;
                options.access_token = access_token;
                api.post(endpoints.data.update)
                    .send(options)
                    .expect(httpStatus.OK)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.updated).to.be.not.empty;
                        expect(result.updated).to.include('name');
                        expect(result.updated).to.include('description');
                        expect(result.updated).to.include('keywords');
                        expect(result.updated).to.include('status');
                        expect(result.updated).to.include('category');
                        expect(result.updated).to.include('version');
                        expect(result.updated).to.include('copyright');
                        expect(result.updated).to.include('data');
                        expect(result.file.name).to.be.equal(options.name);
                        expect(result.file.description).to.be.equal(options.description);
                        expect(result.file.keywords[0]).to.be.equal(options.keywords[0]);
                        expect(result.file.status).to.be.equal(options.status);
                        expect(result.file.category).to.be.equal(options.category);
                        expect(result.file.version).to.be.equal(options.version);
                        expect(result.file.copyright).to.be.equal(options.copyright);
                        expect(result.file.data.postgis.database_name).to.be.equal(options.data.postgis.database_name);
                        expect(result.file.data.postgis.table_name).to.be.equal(options.data.postgis.table_name);
                        expect(result.file.data.postgis.data_type).to.be.equal(options.data.postgis.data_type);
                        expect(result.file.data.postgis.original_format).to.be.equal(options.data.postgis.original_format);
                        expect(result.file.data.postgis.metadata).to.be.equal(options.data.postgis.metadata);
                        done();
                    });
            });
        });


        // test 6
        it('should should respond with status code 400 if some fields have bad type', function (done) {

            var shouldBeAStringButItIsObject = 'should be string, but now it is an object';
            var shouldBeANumberButItIsObject = 'should be number, but now it is an object';

            helpers.token(function (err, access_token) {
                var options = {
                    uuid: testFile.uuid,
                    name: {name: shouldBeAStringButItIsObject},
                    description: {description: shouldBeAStringButItIsObject},
                    keywords: ['new keywords'],
                    status: {status: shouldBeAStringButItIsObject},
                    category: {category: shouldBeAStringButItIsObject},
                    version: {version: shouldBeANumberButItIsObject},
                    copyright: {copyright: shouldBeAStringButItIsObject},
                    data: 'testData'
                };

                options.access_token = access_token;
                api.post(endpoints.data.update)
                    .send(options)
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }

                        var result = helpers.parse(res.text);

                        expect(result.error.errors.name.value.name).to.be.equal(shouldBeAStringButItIsObject);
                        expect(result.error.errors.name.message).to.be.equal('Cast to String failed for value "{ name: \'should be string, but now it is an object\' }" at path "name"');
                        expect(result.error.errors.description.value.description).to.be.equal(shouldBeAStringButItIsObject);
                        expect(result.error.errors.description.message).to.be.equal('Cast to String failed for value "{ description: \'should be string, but now it is an object\' }" at path "description"');
                        expect(result.error.errors.status.value.status).to.be.equal(shouldBeAStringButItIsObject);
                        expect(result.error.errors.status.message).to.be.equal('Cast to String failed for value "{ status: \'should be string, but now it is an object\' }" at path "status"');
                        expect(result.error.errors.category.value.category).to.be.equal(shouldBeAStringButItIsObject);
                        expect(result.error.errors.category.message).to.be.equal('Cast to String failed for value "{ category: \'should be string, but now it is an object\' }" at path "category"');
                        expect(result.error.errors.version.value.version).to.be.equal(shouldBeANumberButItIsObject);
                        expect(result.error.errors.version.message).to.be.equal('Cast to Number failed for value "{ version: \'should be number, but now it is an object\' }" at path "version"');
                        expect(result.error.errors.copyright.value.copyright).to.be.equal(shouldBeAStringButItIsObject);
                        expect(result.error.errors.copyright.message).to.be.equal('Cast to String failed for value "{ copyright: \'should be string, but now it is an object\' }" at path "copyright"');
                        expect(result.error.errors.data.value).to.be.equal('testData');
                        expect(result.error.errors.data.message).to.be.equal('Cast to Object failed for value "testData" at path "data"');
                        done();
                    });
            });
        });
    });
};