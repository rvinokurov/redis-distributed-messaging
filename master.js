'use strict';
const minimist = require('minimist');
const redis = require('./lib/redis.js');
const logger = require('bunyan').createLogger({name: 'redis-distributed-messaging'});

const pid = process.pid;

logger.info('app started', {pid});

const publisher = redis.getConnection();
const subscriber = redis.getConnection();

subscriber.subscribe('system', (error, message) => {
    console.log('e', error);
    console.log('m', message);
});


subscriber.on("subscribe", function(channel, count) {
    console.log("Subscribed to " + channel + ". Now subscribed to " + count + " channel(s).");
});
