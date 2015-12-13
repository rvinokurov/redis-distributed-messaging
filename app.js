'use strict';

const minimist = require('minimist');
const redis = require('./lib/redis.js');
const logger = require('bunyan').createLogger({name: 'redis-distributed-messaging'});
const _ = require('underscore');
const os = require('os');
const async = require('async');

var argv = require('minimist')(process.argv.slice(2));
const MessageEmitter = require('./lib/message-emitter.js');
const MessageManager = require('./lib/message-manager.js');

let scope = {
    nodeList: [],
    nodeInfo: [],
    logger: logger
};

logger.info('app started', {pid: process.pid});

let publisher;
let subscriber;


let resetPing = null;
let nextNodePingTimeout = null;

scope.nodeName = `${os.hostname()}_${process.pid}`;

let messageEmitter = null;
let messageManager = null;




// const processPongMessage = (message) => {
//     clearTimeout(nextNodePingTimeout);
//     setTimeout(resetPing, 3000);
// };



// const processMessages = (channel, message) => {
//     try {
//         message = JSON.parse(message);
//     } catch (e) {
//         logger.error('Error on parse message', {error: e})
//     }
//
//     if(message.node === nodeName) {
//         return;
//     }
//     if(channel === `${nodeName}:ping`) {
//         processPingMessage(message);
//     }
//     if(channel === 'newnode') {
//         processNewNodeMessage(message);
//     }
//     if(channel === 'kill') {
//         processKillMessage(message);
//     }
//     if(channel === `${nodeName}:pong`) {
//         processPongMessage(message);
//     }
//     if(channel === 'updatenodelist') {
//         processUpdateNodeList(message);
//     }
// };

const initRedisConnections  = (callback) => {
    async.parallel({
        publisher: redis.getConnection.bind(null, 'publisher'),
        subscriber: redis.getConnection.bind(null,'subscriber')
    }, (error, result) => {
        scope.publisher = result.publisher;
        scope.subscriber = result.subscriber;
        callback(error);
    });
};

// const getNextNode = () => {
//     let myIndex = _.indexOf(nodeList, nodeName);
//     return myIndex + 1 == nodeList.length ? nodeList[0] : nodeList[myIndex + 1];
// };

// const tryToPingNextNode = (next) => {
//     let nextNode = getNextNode();
//     if(nextNode === nodeName) {
//         setTimeout(next, 3000);
//     } else {
//
//         resetPing = next;
//         nextNodePingTimeout = setTimeout(() => {
//             console.log('node dead', nextNode);
//             nodeList = _.without(nodeList, nextNode);
//             if(nodeInfo[nextNode]) {
//                 nodeInfo[nodeName] = true;
//                 logger.info(`new master is ${nodeName}`);
//                 //start broadcast
//             }
//             delete nodeInfo[nodeList]; //check if nextNode is master
//
//             console.log('current node list', nodeList);
//             publisher.set('nodelist', JSON.stringify(nodeList));
//             publisher.set('nodeinfo', JSON.stringify(nodeInfo));
//             publisher.publish(`updatenodelist`, JSON.stringify({nodeList, nodeInfo}));
//             next(null);
//         }, 3000);
//         console.log('ping node', nextNode);
//         publisher.publish(`${nextNode}:ping`, JSON.stringify({node: nodeName}));
//     }
// };




async.series([
    initRedisConnections,
    (callback) => {
        if(argv.flush) {
            logger.info('Clear node information, send kill message to other nodes..');
            scope.publisher.flushdb(callback);
            scope.publisher.publish('kill', JSON.stringify({node: scope.nodeName}));
        } else {
            callback(null);
        }
    },
    (callback) => {
        async.parallel({
            nodeList : scope.publisher.get.bind(scope.publisher, 'nodelist'),
            nodeInfo : scope.publisher.get.bind(scope.publisher, 'nodeinfo')
        }, (error, result) => {
            if(result.nodeList) {
                try {
                    scope.nodeList = JSON.parse(result.nodeList);
                    scope.nodeInfo = JSON.parse(result.nodeInfo);
                } catch(e) {
                    scope.nodeList = []
                    scope.nodeInfo = {}
                }
            } else {
                scope.nodeList = []
                scope.nodeInfo = {}
            }


            callback(error);
        })

    },
    callback => {

        messageEmitter = new MessageEmitter(scope);
        messageManager = new MessageManager(scope);
        messageEmitter.subscribe({
            [`${scope.nodeName}:ping`] : message => messageManager.ping(message),
            // `${scope.nodeName}:pong`,
            'newnode':  message => messageManager.newNode(message),
            'kill': message => messageManager.kill(message),
            'updatenodelist': message => messageManager.updateNodeList(message),
        }, callback)
    },
    (callback) => {
        let isMaster = false;
        if(!scope.nodeList.length) {
            isMaster = true;
            logger.info('start message generator');
        } else {
            console.log('start message listener');
            console.log('new node');
            scope.publisher.publish('newnode', JSON.stringify({node: scope.nodeName}));
        }
        scope.nodeList.push(scope.nodeName);
        scope.nodeInfo[scope.nodeName] = isMaster;

        scope.publisher.set('nodelist', JSON.stringify(scope.nodeList));
        scope.publisher.set('nodeinfo', JSON.stringify(scope.nodeInfo));

        // async.forever(tryToPingNextNode)
    }
]);
