const semver = require('semver');
const nodejsVersion = semver.parse(process.versions.node).major;

module.exports = nodejsVersion >= 8 ? require(__dirname + '/lib/HarmonyHubWS') : require(__dirname + '/lib/HarmonyHubWS_ES2016');