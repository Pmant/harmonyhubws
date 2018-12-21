// Logitech Harmony Class using websocket instead of old (removed) api
// Credit for finding/sharing knowledge about the api goes to:
//	https://github.com/jlynch630/Harmony.NET
//	https://github.com/chadcb/harmonyhub
//
//  ported to node.js from https://github.com/d-EScape/HarmonyApi
//  by: https://github.com/Pmant

'use strict';
const ws = require('ws');
const rp = require('request-promise-native');
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 1000;

class HarmonyHubWS extends EventEmitter {
    constructor(ip, watchdog = true) {
        super();
        this.ip = ip;
        this.port = 8088;
        this.url = 'http://' + this.ip + ':' + this.port;
        this.requestId = 0;
        this.status = 0;
        this.timeout = 30;
        this.pingTime = 15000;
        this.watchdog = !!watchdog;
        this.watchdogTime = 15000;
        this.hubDomain = 'svcs.myharmony.com';
        this.init();
        //watchdog
        if (this.watchdog) {
            this.watchdogInterval = setInterval(() => {
                if (this.status === 0) {
                    clearInterval(this.pingInterval);
                    this.emit('offline');
                    if (this.ws) {
                        try {
                            this.ws.close();
                        } catch (e) {
                            this.emit('warning');
                        }
                        delete this.ws;
                    }
                    this.init();
                }
            }, this.watchdogTime);
        }
    }

    close() {
        clearInterval(this.watchdogInterval);
        if (this.ws) {
            this.ws.close();
            delete this.ws;
        } else {
            this.emit('offline')
        }
    }

    async init() {
        try {
            this.status = 1;
            this.hubId = await this.getHubId();
            const wsUrl = 'ws://' + this.ip + ':' + this.port + '?domain=' + this.hubDomain + '&hubId=' + this.hubId;
            const socket = new ws(wsUrl);
            socket.on('open', () => {
                this.status = 2;
                setTimeout(() => {
                    this.requestState();
                }, 1000);
                this.pingInterval = setInterval(() => {
                    this.ws.ping();
                }, this.pingTime);
            });
            socket.on('message', (data) => {
                this.parseMessage(data);
            });
            socket.on('close', () => {
                this.emit('offline');
                this.status = 0;
                clearInterval(this.pingInterval);
            });
            this.ws = socket;
        } catch (e) {
            this.emit('warning', 'could not connect to hub', this.ip);
            this.emit('offline');
            this.status = 0;
        }
    }

    parseMessage(data) {
        try {
            data = JSON.parse(data);
        } catch (e) {
            this.emit('warning');
        }

        if (data.cmd || data.type) {
            const cmdType = data.cmd || data.type;
            switch (cmdType) {
                case 'connect.stateDigest?notify':
                case 'vnd.logitech.connect/vnd.logitech.statedigest?get':
                    if (this.status === 2) {
                        this.status = 3;
                        this.emit('online', this.hubId);
                    } else {
                        this.emit('state', data.data.activityId, data.data.activityStatus);
                    }
                    break;
                case 'vnd.logitech.harmony/vnd.logitech.harmony.engine?config':
                    this.emit('config', data.data);
                    break;
                default:
                    break;
            }
        }
    }

    async getHubId() {
        const options = {
            method: 'POST',
            uri: this.url,
            body: {
                'id': 'hws' + this.requestId++,
                'cmd': 'connect.discoveryinfo?get',
                'params': {}
            },
            headers: {
                'Content-type': 'application/json',
                'Accept': 'text/plain',
                'Origin': 'http//:localhost.nebula.myharmony.com'
            },
            json: true // Automatically stringifies the body to JSON
        };
        try {
            const response = await rp(options);
            this.hubDomain = response.data.discoveryServerUri.split('/')[2];
            return response.data.remoteId;
        } catch (e) {
            throw e;
        }
    }

    async requestActivityChange(activityId) {
        const options = {
            method: 'POST',
            uri: this.url,
            body: {
                'cmd': 'harmony.activityengine?runactivity',
                'params': {
                    'activityId': activityId
                }
            },
            headers: {
                'Content-type': 'application/json',
                'Accept': 'text/plain',
                'Origin': 'http//:localhost.nebula.myharmony.com'
            },
            json: true // Automatically stringifies the body to JSON
        };
        await rp(options);
    }


    requestState() {
        const payload = {
            //hubId: this.hubId;
            timeout: this.timeout,
            hbus: {
                cmd: 'vnd.logitech.connect/vnd.logitech.statedigest?get',
                id: 'hws' + this.requestId++,
                params: {'verb': 'get', 'format': 'json'}
            }
        };
        this.send(payload);
    }

    requestConfig() {
        const payload = {
            //hubId: this.hubId;
            timeout: this.timeout,
            hbus: {
                cmd: 'vnd.logitech.harmony/vnd.logitech.harmony.engine?config',
                id: 'hws' + this.requestId++,
                params: {'verb': 'get'}
            }
        };
        this.send(payload);
    }

    requestKeyPress(deviceId, keyId, type = 'IRCommand', hold = 'press') {
        let action = {};
        if (typeof deviceId === 'string') {
            action = deviceId;
            hold = keyId || 'press';
        } else {
            action = JSON.stringify({
                deviceId: deviceId,
                command: keyId,
                type: type,
            });
        }
        const payload = {
            //hubId: this.hubId;
            timeout: this.timeout,
            hbus: {
                cmd: 'vnd.logitech.harmony/vnd.logitech.harmony.engine?holdAction',
                id: 'hws' + this.requestId++,
                params: {
                    action: action,
                    timestamp: '0',
                    status: hold,
                },
            }
        };
        this.send(payload);
    }

    send(data) {
        if (this.ws && this.status >= 2)
            this.ws.send(JSON.stringify(data));
    }
}

module.exports = HarmonyHubWS;