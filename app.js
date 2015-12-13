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
const NodeManager = require('./lib/node-manager.js');
const clearErrorQueue = require('./lib/clear-error-queue.js')


let scope = {
    nodeList: [],
    nodeInfo: [],
    logger: logger
};

logger.info('app started', {pid: process.pid});

let publisher;
let subscriber;



scope.nodeName = `${os.hostname()}_${process.pid}`;

let messageEmitter = null;
let messageManager = null;
let nodeManager = null;




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

async.series([
    initRedisConnections,
    (callback) => {
         if(argv.getErrors) {
             logger.info('Start to get and clear errors queue...');
             clearErrorQueue(scope, () => {
                 logger.info('Error queue cleared, exit');
                 process.exit(0);
             })
        } else if(argv.flush) {
            logger.info('Clear node information, send kill message to other nodes..');
            scope.publisher.flushdb(callback);
            scope.publisher.publish('kill', JSON.stringify({node: scope.nodeName}));
        } else {
            callback(null);
        }
    },

    callback => {

        messageEmitter = new MessageEmitter(scope);
        messageManager = new MessageManager(scope);
        messageEmitter.subscribe({
            [`${scope.nodeName}:ping`] : message => messageManager.ping(message),
            [`${scope.nodeName}:message`] : message => messageManager.message(message),
            'newnode':  message => messageManager.newNode(message),
            'kill': message => messageManager.kill(message),
            'updatenodelist': message => messageManager.updateNodeList(message),
        }, callback)
    },

    callback => {
        nodeManager = new NodeManager(scope, messageEmitter);
        nodeManager.init(callback);
    },
    callback => {
        nodeManager.watchClosestNodeStatus();
    }
]);
