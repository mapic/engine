var fs = require("fs");
var crypto = require("crypto");

// set config folder
var ENGINE_DEFAULT_CONFIG_PATH  = '/mapic/engine/default.config.js';
var ENGINE_CONFIG_PATH  = '/mapic/engine/config.js';

var MAPIC_DOMAIN = process.env.MAPIC_DOMAIN;
var MAPIC_REDIS_AUTH = process.env.MAPIC_REDIS_AUTH;
var MAPIC_MONGO_AUTH = process.env.MAPIC_MONGO_AUTH;
var MAPIC_MONGO_DB = process.env.MAPIC_MONGO_DB;
var MAPIC_MONGO_USER = process.env.MAPIC_MONGO_USER;
var MAPIC_SLACK_WEBHOOK = process.env.MAPIC_SLACK_WEBHOOK;
var MAPIC_SLACK_TOKEN = process.env.MAPIC_SLACK_TOKEN;
var MAPIC_NODEMAILER_USER = process.env.MAPIC_NODEMAILER_USER;
var MAPIC_NODEMAILER_AUTH = process.env.MAPIC_NODEMAILER_AUTH;
var MAPIC_NODEMAILER_HOST = process.env.MAPIC_NODEMAILER_HOST;
var MAPIC_NODEMAILER_PORT = process.env.MAPIC_NODEMAILER_PORT;
var MAPIC_LOGIN_LOGO = process.env.MAPIC_LOGIN_LOGO;


console.log('env:');
console.log(process.env);


console.log('$##############################33');
console.log('$##############################33');
console.log('$##############################33');
console.log('$##############################33');
console.log('$##############################33');
console.log('$##############################33');
console.log('$##############################33');
console.log('refresh-config.js');

// read config
var engineConfig = require(ENGINE_DEFAULT_CONFIG_PATH);
engineConfig.serverConfig.mongo.url =  'mongodb://' + MAPIC_MONGO_USER + ':' + MAPIC_MONGO_AUTH + '@mongo/' + MAPIC_MONGO_DB;
engineConfig.serverConfig.redis.auth = MAPIC_REDIS_AUTH;

// get domains
var domain_split = MAPIC_DOMAIN.split('.').reverse();
var MAPIC_ROOT_DOMAIN = domain_split[1] + '.' + domain_split[0];
var MAPIC_SUBDOMAIN = domain_split.reverse()[0];
var MAPIC_BASE_URL = 'https://' + MAPIC_DOMAIN;

// add
engineConfig.serverConfig.portalServer.uri = 'https://' + MAPIC_DOMAIN + '/';
engineConfig.clientConfig.servers.portal = 'https://' + MAPIC_DOMAIN + '/';
engineConfig.clientConfig.servers.subdomain = 'https://{s}.' + MAPIC_ROOT_DOMAIN + '/';
engineConfig.clientConfig.servers.tiles.uri = 'https://{s}.' + MAPIC_ROOT_DOMAIN + '/v2/tiles/';
engineConfig.clientConfig.servers.tiles.subdomains = [
    'tiles-a-' + MAPIC_SUBDOMAIN, 
    'tiles-b-' + MAPIC_SUBDOMAIN, 
    'tiles-c-' + MAPIC_SUBDOMAIN, 
    'tiles-d-' + MAPIC_SUBDOMAIN 
];
engineConfig.clientConfig.servers.cubes.uri = 'https://{s}.' + MAPIC_ROOT_DOMAIN + '/v2/cubes/';
engineConfig.clientConfig.servers.cubes.subdomains = engineConfig.clientConfig.servers.tiles.subdomains;
engineConfig.clientConfig.servers.proxy.uri = 'https://{s}.' + MAPIC_ROOT_DOMAIN + '/v2/tiles/';
engineConfig.clientConfig.servers.proxy.subdomains = [
    'proxy-a-' + MAPIC_SUBDOMAIN, 
    'proxy-b-' + MAPIC_SUBDOMAIN, 
    'proxy-c-' + MAPIC_SUBDOMAIN, 
    'proxy-d-' + MAPIC_SUBDOMAIN 
];
engineConfig.clientConfig.servers.utfgrid.uri = 'https://{s}.' + MAPIC_ROOT_DOMAIN + '/v2/tiles/';
engineConfig.clientConfig.servers.utfgrid.subdomains = [
    'grid-a-' + MAPIC_SUBDOMAIN, 
    'grid-b-' + MAPIC_SUBDOMAIN, 
    'grid-c-' + MAPIC_SUBDOMAIN, 
    'grid-d-' + MAPIC_SUBDOMAIN 
];

// slack
engineConfig.serverConfig.slack.webhook = MAPIC_SLACK_WEBHOOK;
engineConfig.serverConfig.slack.token = MAPIC_SLACK_TOKEN;
engineConfig.serverConfig.slack.baseurl = engineConfig.serverConfig.portalServer.uri;

// nodemailer
engineConfig.serverConfig.nodemailer.host = MAPIC_NODEMAILER_HOST;
engineConfig.serverConfig.nodemailer.port = MAPIC_NODEMAILER_PORT;
engineConfig.serverConfig.nodemailer.auth.user = MAPIC_NODEMAILER_USER;
engineConfig.serverConfig.nodemailer.auth.pass = MAPIC_NODEMAILER_AUTH;

engineConfig.serverConfig.logo_base64 = MAPIC_LOGIN_LOGO;

// write config
var engineJsonStr = 'module.exports = ' + JSON.stringify(engineConfig, null, 2);
fs.writeFileSync(ENGINE_CONFIG_PATH , engineJsonStr, 'utf-8');

// create png from base64 logo
if (MAPIC_LOGIN_LOGO) {
    var base64_logo = MAPIC_LOGIN_LOGO.replace('"', '');
    var MAPIC_LOGIN_LOGO_PATH = '/mapic/engine/public/css/flash-logo.png';
    fs.writeFileSync(MAPIC_LOGIN_LOGO_PATH, base64_logo, 'base64');
} else {
    console.log('Missing $MAPIC_LOGIN_LOGO variable. No logo created!');
}

console.log('mapic/engine config updated!');
