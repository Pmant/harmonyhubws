const semver = require('semver');
const nodejsVersion = semver.parse(process.versions.node).major;

const client = require(__dirname + '/lib/HarmonyHubWS');
const clientES2016 = require(__dirname + '/lib/HarmonyHubWS_ES2016');

module.exports = nodejsVersion >= 8 ? client : clientES2016;