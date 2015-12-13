'use strict';
const EventEmitter = require('events');
const async = require('async');
const _ = require('underscore');

const config = require('../config.json').MessageEmitter;

let mixedConfig = _.defaults(config, {
    maxListeners: 50
});

module.exports = class MessageEmitter extends EventEmitter {

    constructor(scope) {
        super();
        this.setMaxListeners(mixedConfig.maxListeners);
        this.logger = scope.logger;
        this.nodeName = scope.nodeName;
        this.subscriber = scope.subscriber;
        this._listen();
    }

    _listen() {
        this.subscriber.on("subscribe", (channel, count)  => {
            this.logger.info("Subscribed to " + channel + ". Now subscribed to " + count + " channel(s).");
        });

        this.subscriber.on('message', (channel, message) => {
            try {
                message = JSON.parse(message);
            } catch (e) {
                this.logger.error('Error on parse message', {error: e})
            }
            if(message.node === this.nodeName) {
                return;
            }

            this.emit(channel, message);
        });
    }

    subscribe(subscriptions, callback) {
        if(_.isArray(subscriptions)) {
            async.parallel(
                _.map(subscriptions, subscription => {
                    return callback => this.subscriber.subscribe(subscription, callback);
                }),
                callback
            );
        } else if(_.isObject(subscriptions)) {
            async.parallel(
                _.map(Object.keys(subscriptions), subscription => {
                    this.on(subscription, subscriptions[subscription]);
                    return callback => this.subscriber.subscribe(subscription, callback);
                }),
                callback
            )
        }

    }
};
