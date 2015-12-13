'use strict';
const EventEmitter = require('events');
const async = require('async');
const _ = require('underscore');


module.exports = class MessageEmitter extends EventEmitter {

    constructor(scope) {
        super();
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
            console.log(channel);
            try {
                message = JSON.parse(message);
            } catch (e) {
                logger.error('Error on parse message', {error: e})
            }
            if(message.node === this.nodeName) {
                return;
            }

            this.emit(channel, message);
        });
    }

    subscribe(subscriptions, callback) {
        async.parallel(
            _.map(Object.keys(subscriptions), subscription => {
                this.on(subscription, subscriptions[subscription]);
                return callback => this.subscriber.subscribe(subscription, callback);
            }),
            callback
        )
    }
};
