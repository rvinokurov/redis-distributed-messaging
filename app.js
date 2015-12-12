'use strict';

const minimist = require('minimist');
const redis = require('./lib/redis.js');
const logger = require('bunyan').createLogger({name: 'redis-distributed-messaging'});


const pid = process.pid;

logger.info('app started', {pid});

const publisher = redis.getConnection();
const subscriber = redis.getConnection();


let master_pid = null;

let isMaster = false;


let masterTimeout = null;
let searchMasterTimeout = null;
let recieved_master_pid = null;
const listenWhoIsMaster = () => {
    let masterMessage = {
        'type': 'I_AM_MASTER',
        pid
    };

    subscriber.on('message', (channel, message) => {
        if(channel === 'system') {
            message = JSON.parse(message);
        }
        if(message.type === 'WHO_IS_MASTER' && isMaster ) {
            publisher.publish('system', JSON.stringify(masterMessage));
        }
    });
}

const detectMaster = () => {
    let message = {
        'type': 'WHO_IS_MASTER',
        pid
    };

    setInterval(function() {
        recieved_master_pid = null;
        publisher.publish('system', JSON.stringify(message));
        clearTimeout(masterTimeout);
        masterTimeout = setTimeout(function() {
            if(!recieved_master_pid) {
                isMaster = true;
                master_pid = pid;
                console.log('i am master', pid);
            }
        }, 500);
    }, 500);





    subscriber.on('message', (channel, message) => {
        // console.log(channel, message);
        if(channel === 'system') {
            message = JSON.parse(message);
        }
        if(message.type === 'I_AM_MASTER') {
            recieved_master_pid = message.pid;
            if(master_pid != message.pid) {
                master_pid = message.pid;
                console.log('master', master_pid);
            }
            clearTimeout(masterTimeout);
        }
    });
};

const init = () => {
    listenWhoIsMaster();
    detectMaster();


};

subscriber.on("subscribe", function(channel, count) {
    console.log("Subscribed to " + channel + ". Now subscribed to " + count + " channel(s).");
    init();


});


subscriber.subscribe('system');
