# HarmonyHubWS
[![NPM version](http://img.shields.io/npm/v/harmonyhubws.svg)](https://www.npmjs.com/package/harmonyhubws)
[![Downloads](https://img.shields.io/npm/dm/harmonyhubws.svg)](https://www.npmjs.com/package/harmonyhubws)
[![Build Status](https://travis-ci.org/Pmant/harmonyhubws.svg?branch=master)](https://travis-ci.org/Pmant/harmonyhubws)
[![Build status](https://ci.appveyor.com/api/projects/status/nojapw16sp1nd1g4?svg=true)](https://ci.appveyor.com/project/Pmant/harmonyhubws)


A node module for Logitech Harmony Hub.

Uses a simple watchdog to reconnect on connection losses.

## Installation
```npm install harmonyhubws --production```

<a name="example"></a>
## Usage Example
with Hub IP 192.168.0.50:
```Javascript
const util = require('util');
const HarmonyHubWS = require('harmonyhubws');
const IP = '192.168.0.50';

let harmonyHubWS = new HarmonyHubWS(IP);
harmonyHubWS.on('online', () => {
    console.log('connected to hub', IP);
    //request config
    harmonyHubWS.requestConfig();
});

harmonyHubWS.on('config', (config) => {
    //be careful, config could be very big!
    console.log('config', util.inspect(config,false, null, true));
    //request hub state
    harmonyHubWS.requestState();

    //if there is a device press first button of device
    if (config.device.length) {
        let device = config.device[0];
        if (device.controlGroup.length && device.controlGroup[0].function.length) {
            console.log('pressing key', device.label, device.controlGroup[0].function[0].label);
            harmonyHubWS.requestKeyPress(device.controlGroup[0].function[0].action);
        }
    }

    //if there is an activity start it
    if (config.activity.length) {
        let activity = config.activity[0];
        console.log('starting activity', activity.label);
        harmonyHubWS.requestActivityChange(activity.id);
    }
});

harmonyHubWS.on('state', (activityId, activityStatus) => {
    console.log('state', activityId, activityStatus);
    //if an activity is started turn it off and close client
    if (activityStatus === 2) {
        console.log('activity started, turn off', activityId);
        harmonyHubWS.requestActivityChange('-1');
        harmonyHubWS.close();
    }
});

harmonyHubWS.on('offline', () => {
    console.log('lost connection to hub', IP);
});
```

<a name="harmonyHubWS"></a>
### new HarmonyHubWS(ip, watchdog)
Returns the state object of the robot. Also updates all robot properties.
* `ip`: `string` - IP of your Harmony Hub
* [`watchdog`]: `boolean` - defaults to true
* example:
 ```Javascript
const HarmonyHubWS = require('harmonyhubws');
const IP = '192.168.0.50';

//start client without automatic connection handling
let harmonyHubWS = new HarmonyHubWS(IP, false);
```

## Functions
<a name="requestConfig"></a>
### requestConfig()
Asks Hub to send Config. To retrieve config use event `config`.

<a name="requestState"></a>
### requestState()
Asks Hub to send current state. To retrieve current state use event `state`.

<a name="requestActivityChange"></a>
### requestActivityChange(activityId)
Asks Hub to start activity with ID `activityId`. Results in multiple state events, `activityState` will be `2` when the activity is completely started.
* `activityId`: `number|string` - ID of the activity you want to start, use `'-1'` (string!) to turn off any activity. To retrieve activity IDs see [requestConfig](#requestConfig).

<a name="requestKeyPress"></a>
### requestKeyPress(action, hold = 'press', delay = 100)
Asks Hub to press a device key. 
* `action`: `string` - whole action string (deviceId, keyId, type) as retrieved from [config](#requestConfig).
* [`hold`]: `string` 'press' or 'hold' - defaults to `press`, `hold` is a long press for ~250ms, if you want to hold longer you need to request hold repeatedly.
* [`delay`]: `number` defaults to `100`, how long the key is held


or 

### requestKeyPress(deviceId, keyId, type = 'IRCommand', hold = 'press', delay = 100)
* `deviceId`: `number` - ID of the device you want to control. To retrieve device IDs see [requestConfig](#requestConfig).
* `keyId`: `number` - ID of the key you want to press. To retrieve key Ids see [requestConfig](#requestConfig).
* [`type`]: `number` - defaults to `IRCommand`. To retrieve key types see [requestConfig](#requestConfig).
* [`hold`]: `string` 'press' or 'hold' - defaults to `press`, `hold` is a long press for ~250ms, if you want to hold longer you need to request hold repeatedly.
* [`delay`]: `number` defaults to `100`, how long the key is held

## Events
<a name="online"></a>
### .on('online', () => {})
Fired when connection to hub is established.

<a name="offline"></a>
### .on('offline', () => {})
Fired when connection to hub is lost.

<a name="state"></a>
### .on('state', (activityId, activityState) => {})
Fired when hub sends its current state. 
* `activityId`: `number|string` - ID of current activity, `'-1'` for powerOff.
* `activityState`: `number` - state of current activity, where 
    * `0`: off
    * `1`: starting (hub blocked until activityState is 2)
    * `2`: started  
    * `3`: stopping (hub blocked until activityState is 0)

<a name="config"></a>
### .on('config', (config) => {})
Fired when hub sends its configuration (devices, activities). 
* `config`: `object` - Hubs configuration. For details see [example](#harmonyHubWS).

## Changelog
### 1.0.0
* (Pmant) initial commit

