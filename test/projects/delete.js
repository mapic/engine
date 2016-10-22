var assert = require('assert');
var supertest = require('supertest');
var chai = require('chai');
var expect = chai.expect;
// var api = supertest('https://' + process.env.SYSTEMAPIC_DOMAIN);
var helpers = require('../helpers');
var token = helpers.token;
var httpStatus = require('http-status');
var expected = require('../../shared/errors');
var endpoints = require('../endpoints.js');
var testData = require('../shared/project/delete.json');
var testProject = testData.projectInfo;

// api
var domain = (process.env.MAPIC_DOMAIN == 'localhost') ? 'https://172.17.0.1' : 'https://' + process.env.MAPIC_DOMAIN;
var api = supertest(domain);

module.exports = function () {
    var tmpProject = {};
    before(function (done) {
        helpers.create_project_by_info(testProject, function (err, project) {
            if (err) return done(err);
            tmpProject = project;
            done();
        });
    });
    after(function (done) {
        helpers.delete_project_by_id(tmpProject.uuid, done);
    });



    describe(endpoints.projects.delete, function () {

        // test 1
        it('should be able to delete project', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.projects.delete)
                    .send({
                        project_id: tmpProject.uuid,
                        access_token: access_token
                    })
                    .expect(httpStatus.OK)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.deleted).to.be.true;
                        expect(result.project).to.be.equal(tmpProject.uuid);
                        done();
                    });
            });
        });



        // test 2
        it("should respond with status code 401 when not authenticated", function (done) {
            api.post(endpoints.projects.delete)
                .send()
                .expect(httpStatus.UNAUTHORIZED)
                .end(done);
        });



        // test 3
        it('should respond with status code 400 and specific error message if project_id doesn\'t exist in request body', function (done) {
            token(function (err, access_token) {
                if (err) return done(err);
                api.post(endpoints.projects.delete)
                    .send({access_token: access_token})
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.error.message).to.be.equal(expected.missing_information.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.BAD_REQUEST);
                        done();
                    });
            });
        });



        // test 4
        it('should respond with status code 404 and specific error message if project doesn\'t exist', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.projects.delete)
                    .send({
                        foo: 'mocha-test-updated-name',
                        access_token: access_token,
                        project_id: 'bad id'
                    })
                    .expect(httpStatus.NOT_FOUND)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.error.message).to.be.equal(expected.no_such_project.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.NOT_FOUND);
                        done();
                    });
            });
        });
    });
};