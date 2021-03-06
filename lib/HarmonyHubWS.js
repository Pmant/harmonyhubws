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
            this.emit('offline');
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
                'cmd': 'setup.account?getProvisionInfo',
                'params': {}
            },
            headers: {
                'Content-type': 'application/json',
                'Accept': 'text/plain',
                'Origin': 'http://sl.dhg.myharmony.com'
            },
            json: true // Automatically stringifies the body to JSON
        };
        try {
            const response = await rp(options);
            this.hubDomain = response.data.discoveryServer.split('/')[2];
            return response.data.activeRemoteId;
        } catch (e) {
            throw e;
        }
    }

    async requestActivityChange(activityId) {
        const payload = {
            //hubId: this.hubId;
            timeout: this.timeout,
            hbus: {
                cmd: 'vnd.logitech.harmony/vnd.logitech.harmony.engine?startActivity',
                id: 'hws' + this.requestId++,
                params: {
                    'verb': 'get',
                    activityId: activityId,
                    args: {
                        rule: 'start'
                    }
                }
            }
        };
        this.send(payload);
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

    requestKeyPress(deviceId, keyId, type = 'IRCommand', hold = 'press', delay = 100) {
        let action = {};
        if (deviceId == +deviceId) {
            action = JSON.stringify({
                deviceId: deviceId,
                command: keyId,
                type: type,
            });
        } else {
            action = deviceId;
            if (typeof keyId === 'string')
                hold = keyId;
            if (typeof keyId === 'number')
                delay = keyId;
            if (typeof type === 'number')
                delay = type;
        }
        const payload = {
            //hubId: this.hubId;
            timeout: this.timeout,
            hbus: {
                cmd: 'vnd.logitech.harmony/vnd.logitech.harmony.engine?holdAction',
                id: 'hws' + this.requestId++,
                params: {
                    status: 'press',
                    timestamp: '0',
                    verb: 'render',
                    action: action
                },
            }
        };
        if (hold === 'press') {
            payload.hbus.params.verb = 'render';
            this.send(payload);
            payload.hbus.params.timestamp = delay.toString();
            payload.hbus.params.status = 'release';
            this.send(payload);
        } else if (hold === 'hold') {
            this.send(payload);
            payload.hbus.params.status = 'hold';
            const interval = setInterval(() => {
                this.send(payload);
            }, 250);
            setTimeout(() => {
                clearInterval(interval);
                payload.hbus.params.timestamp = '250';
                payload.hbus.params.status = 'release';
            }, delay - 250);
        }
    }

    send(data) {
        if (this.ws && this.status >= 2)
            this.ws.send(JSON.stringify(data));
    }
}

module.exports = HarmonyHubWS;
