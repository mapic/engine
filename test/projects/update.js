var mongoose = require('mongoose');
var async = require('async');
var fs = require('fs');
var crypto = require('crypto');
var request = require('request');
var supertest = require('supertest');
var chai = require('chai');
var expect = chai.expect;
var api = supertest('https://' + process.env.SYSTEMAPIC_DOMAIN);
var User = require('../../models/user');
var config = require('../../config/wu-config.js').serverConfig;
var helpers = require('./../helpers');
var token = helpers.token;
var expected = require('../../shared/errors');
var httpStatus = require('http-status');
var endpoints = require('../endpoints.js');


// varialbes: todo: move to shared file
var second_test_user = {
    email : 'second_mocha_test_user@systemapic.com',
    firstName : 'Igor',
    lastName : 'Ziegler',
    uuid : 'second_test-user-uuid',
    password : 'second_test-user-password'
};

module.exports = function () {
    var tmpProject ={};

    before(function (done) {
        helpers.create_project_by_info({
            name: 'mocha-test-project',
            uuid: 'mocha-test-project-uuid',
            access: {
                edit: [helpers.test_user.uuid]
            },
            createdBy: helpers.test_user.uuid
        }, function (err, project) {
            if (err) return done(err);
            tmpProject = project;
            done();
        });
    });

    after(function (done) {
        helpers.delete_project_by_id(tmpProject.uuid, done);
    });

    describe(endpoints.projects.update, function () {


        // test 1
        it("should respond with status code 401 when not authenticated", function (done) {
            api.post(endpoints.projects.update)
                .send({
                    name: 'mocha-test-updated-name',
                    project_id: 'some project id'
                })
                .expect(httpStatus.UNAUTHORIZED)
                .end(done);
        });


        // test 2
        it('should respond with status code 400 and specific error message if no project_id', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.projects.update)
                    .send({
                        name: 'mocha-test-updated-name',
                        access_token: access_token
                    })
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.error.message).to.be.equal(expected.missing_information.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.BAD_REQUEST);
                        expect(result.error.errors.missingRequiredFields).to.be.an.array;
                        expect(result.error.errors.missingRequiredFields).to.include('project_id');
                        done();
                    });
            });
        });



        // test 3
        it('should respond with status code 400 and specific error message if no field to update', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.projects.update)
                    .send({
                        project_id: tmpProject.uuid,
                        access_token: access_token
                    })
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


        before(function (done) {
            helpers.create_user_by_parameters(second_test_user, done);
        });

        after(function (done) {
            helpers.delete_user_by_id(second_test_user.uuid, done);
        });



        // test 4
        it('should respond with status code 400 and specific error message when not authorized', function (done) {
            helpers.users_token(second_test_user, function (err, access_token) {
                api.post(endpoints.projects.update)
                    .send({
                        name: 'mocha-test-updated-name',
                        project_id: tmpProject.uuid,
                        access_token: access_token
                    })
                    .expect(httpStatus.BAD_REQUEST)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.error.message).to.be.equal(expected.no_access.errorMessage);
                        expect(result.error.code).to.be.equal(httpStatus.BAD_REQUEST);
                        done();
                    });
            });
        });


        // test 5
        it('should respond with status code 200 and shouldn\'t update nonexistent fields', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.projects.update)
                    .send({
                        project_has_not_this_field: 'mocha-test-updated-name',
                        project_id: tmpProject.uuid,
                        access_token: access_token
                    })
                    .expect(httpStatus.OK)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.updated).to.be.an.array;
                        expect(result.project).to.exist;
                        done();
                    });
            });
        });


        // test 6
        it('should be able to update all fields of project', function (done) {
            token(function (err, access_token) {
                api.post(endpoints.projects.update)
                    .send({
                        access_token: access_token,
                        name: 'mocha-test-updated-name',
                        slug: 'mocha-test-updated-slug',
                        logo: 'mocha-test-updated-logo',
                        position: {lat: 44, lng: 44, zoom: 4},
                        bounds: {
                            northEast: {
                                lat: 44,
                                lng: 33
                            },
                            southWest: {
                                lat: 55,
                                lng: 44
                            },
                            minZoom: 3,
                            maxZoom: 5
                        },
                        folders: [{
                            uuid: "test_folder_uuid",
                            title: "test_folder_title",
                            content: "test_folder_content"
                        }],
                        controls: {
                            zoom: false,
                            measure: false,
                            description: false,
                            mouseposition: false,
                            layermenu: false,
                            draw: false,
                            legends: true,
                            inspect: true,
                            geolocation: true,
                            vectorstyle: true,
                            baselayertoggle: true,
                            cartocss: true
                        },
                        description: 'mocha-test-updated-description',
                        keywords: 'mocha-test-updated-keywords',
                        colorTheme: 'mocha-test-updated-colorTheme',
                        connectedAccounts: {
                            mapbox: [{
                                username: 'test_user_name',
                                accessToken: 'test_access_token'
                            }],
                            cartodb: ["test_cartodb"]
                        },
                        settings: {
                            screenshot: false,
                            socialSharing: false,
                            documentsPane: false,
                            dataLibrary: false,
                            saveState: true,
                            autoHelp: true,
                            autoAbout: true,
                            darkTheme: true,
                            tooltips: true,
                            mediaLibrary: true,
                            mapboxGL: true,
                            d3popup: true
                        },
                        categories: ['test_categories'],
                        thumbCreated: true,
                        state: 'test_state',
                        pending: ['test_pending'],
                        project_id: tmpProject.uuid
                    })
                    .expect(httpStatus.OK)
                    .end(function (err, res) {
                        if (err) return done(err);
                        var result = helpers.parse(res.text);
                        expect(result.project.name).to.be.equal('mocha-test-updated-name');
                        expect(result.project.slug).to.be.equal('mocha-test-updated-slug');
                        expect(result.project.logo).to.be.equal('mocha-test-updated-logo');
                        expect(result.project.position.lat).to.be.equal('44');
                        expect(result.project.position.lng).to.be.equal('44');
                        expect(result.project.position.zoom).to.be.equal('4');
                        expect(result.project.bounds.northEast.lat).to.be.equal('44');
                        expect(result.project.bounds.northEast.lng).to.be.equal('33');
                        expect(result.project.bounds.southWest.lat).to.be.equal('55');
                        expect(result.project.bounds.southWest.lng).to.be.equal('44');
                        expect(result.project.bounds.minZoom).to.be.equal('3');
                        expect(result.project.bounds.maxZoom).to.be.equal('5');
                        expect(result.project.folders[0].uuid).to.be.equal('test_folder_uuid');
                        expect(result.project.folders[0].title).to.be.equal('test_folder_title');
                        expect(result.project.folders[0].content).to.be.equal('test_folder_content');
                        expect(result.project.controls.zoom).to.be.false;
                        expect(result.project.controls.measure).to.be.false;
                        expect(result.project.controls.mouseposition).to.be.false;
                        expect(result.project.controls.layermenu).to.be.false;
                        expect(result.project.controls.draw).to.be.false;
                        expect(result.project.controls.legends).to.be.true;
                        expect(result.project.controls.inspect).to.be.true;
                        expect(result.project.controls.geolocation).to.be.true;
                        expect(result.project.controls.vectorstyle).to.be.true;
                        expect(result.project.controls.baselayertoggle).to.be.true;
                        expect(result.project.controls.cartocss).to.be.true;
                        expect(result.project.description).to.be.equal('mocha-test-updated-description');
                        expect(result.project.keywords[0]).to.be.equal('mocha-test-updated-keywords');
                        expect(result.project.categories[0]).to.be.equal('test_categories');
                        expect(result.project.colorTheme).to.be.equal('mocha-test-updated-colorTheme');
                        expect(result.project.connectedAccounts.mapbox[0].username).to.be.equal('test_user_name');
                        expect(result.project.connectedAccounts.mapbox[0].accessToken).to.be.equal('test_access_token');
                        expect(result.project.connectedAccounts.cartodb[0]).to.be.equal('test_cartodb');
                        expect(result.project.settings.screenshot).to.be.false;
                        expect(result.project.settings.socialSharing).to.be.false;
                        expect(result.project.settings.documentsPane).to.be.false;
                        expect(result.project.settings.dataLibrary).to.be.false;
                        expect(result.project.settings.saveState).to.be.true;
                        expect(result.project.settings.autoHelp).to.be.true;
                        expect(result.project.settings.autoAbout).to.be.true;
                        expect(result.project.settings.darkTheme).to.be.true;
                        expect(result.project.settings.tooltips).to.be.true;
                        expect(result.project.settings.mediaLibrary).to.be.true;
                        expect(result.project.settings.mapboxGL).to.be.true;
                        expect(result.project.settings.d3popup).to.be.true;
                        expect(result.project.thumbCreated).to.be.true;
                        expect(result.project.state).to.be.equal('test_state');
                        expect(result.project.pending[0]).to.be.equal('test_pending');
                        expect(result.updated).to.be.an.array;
                        expect(result.updated).to.be.not.empty;
                        done();
                    });
            });
        });

    });
};