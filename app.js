'use strict';

const minimist = require('minimist');
const redis = require('./lib/redis.js');
const logger = require('bunyan').createLogger({name: 'redis-distributed-messaging'});
const _ = require('underscore');
const os = require('os');
const async = require('async');
var argv = require('minimist')(process.argv.slice(2));

const pid = process.pid;

logger.info('app started', {pid});

let publisher;
let subscriber;

let isMaster = false;

const nodeName = `${os.hostname()}_${pid}`;

const processPingMessage = (message) => {
    console.log(message);
    publisher.publish(`${message.node}:pong`, JSON.stringify({node: nodeName}));
    console.log('pong from node', nodeName);
};

const processNewNodeMessage = (message) => {
    nodeList.push(message.node);
    nodeInfo[message.node] = 0;
    logger.info('registered new node. Node List Now', nodeList)
};


const processKillMessage = (message) => {
    logger.info('Recieved kill message. Shutdown');
    process.exit(0);
};



const processMessages = (channel, message) => {
    console.log(channel, message);
    try {
        message = JSON.parse(message);
    } catch (e) {
        logger.error('Error on parse message', {error: e})
    }

    if(message.node === nodeName) {
        return;
    }
    if(channel === `${nodeName}:ping`) {
        processPingMessage(message);
    }
    if(channel === 'newnode') {
        processNewNodeMessage(message);
    }
    if(channel === 'kill') {
        processKillMessage(message);
    }
};

const initRedisConnections  = (callback) => {
    async.parallel({
        publisher: redis.getConnection.bind(null, 'publisher'),
        subscriber: redis.getConnection.bind(null,'subscriber')
    }, (error, result) => {
        publisher = result.publisher;
        subscriber = result.subscriber;
        callback(error);
    });
};

const getNextNode = () => {
    let myIndex = _.indexOf(nodeList, nodeName);
    return myIndex + 1 == nodeList.length ? nodeList[0] : nodeList[myIndex + 1];
};

const tryToPingNextNode = () => {
    let nextNode = getNextNode();
    if(nextNode === nodeName) {
        return;
    } else {
        publisher.publish(`${nextNode}:ping`, JSON.stringify({node: nodeName}));
        console.log('ping node', nextNode);
    }
};



let nodeList = [];
let nodeInfo = [];

async.series([
    initRedisConnections,
    (callback) => {
        if(argv.flush) {
            logger.info('Clear node information, send kill message to other nodes..');
            publisher.flushdb(callback);
            publisher.publish('kill', JSON.stringify({node: nodeName}));
        } else {
            callback(null);
        }
    },
    (callback) => {
        async.parallel({
            nodeList : publisher.get.bind(publisher, 'nodelist'),
            nodeInfo : publisher.get.bind(publisher, 'nodeinfo')
        }, (error, result) => {
            if(result.nodeList) {
                try {
                    nodeList = JSON.parse(result.nodeList);
                    nodeInfo = JSON.parse(result.nodeInfo);
                } catch(e) {
                    nodeList = []
                    nodeInfo = {}
                }
            } else {
                nodeList = []
                nodeInfo = {}
            }


            callback(error);
        })

    },
    (callback) => {
        subscriber.on("subscribe", (channel, count)  => {
            logger.info("Subscribed to " + channel + ". Now subscribed to " + count + " channel(s).");
        });
        callback(null);
    },
    callback => subscriber.subscribe(`${nodeName}:ping`, callback),
    callback => subscriber.subscribe(`newnode`, callback),
    callback => subscriber.subscribe(`kill`, callback),
    (callback) => {
        subscriber.on('message', processMessages)
        callback(null);
    },
    (callback) => {
        console.log(nodeList);
        if(!nodeList.length) {
            logger.info('start message generator');
            isMaster = true;
        } else {
            console.log('start message listener');
            publisher.publish('newnode', JSON.stringify({node: nodeName}));
        }
        nodeList.push(nodeName);
        nodeInfo[nodeName] = isMaster;


        publisher.set('nodelist', JSON.stringify(nodeList));
        publisher.set('nodeinfo', JSON.stringify(nodeInfo));

        tryToPingNextNode();
        setInterval(tryToPingNextNode, 3000);
    }



]);
