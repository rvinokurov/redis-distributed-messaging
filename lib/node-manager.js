'use strict';

const async = require('async');
const _ = require('underscore');
const MessageGenerator = require('./message-generator.js');

module.exports = class MessageManager {

    constructor(scope, messageEmitter) {
        this.pingInterval = 3000;
        this.scope = scope;
        this.logger = scope.logger;
        this.scope.nodeList = [];
        this.scope.nodeInfo = {};
        this.messageEmitter = messageEmitter;
        this.messageGenerator = new MessageGenerator(scope, this, messageEmitter);
    }

    init(callback) {
        let scope = this.scope,
            logger = scope.logger;
        async.parallel({
            nodeList : scope.publisher.get.bind(scope.publisher, 'nodelist'),
            nodeInfo : scope.publisher.get.bind(scope.publisher, 'nodeinfo')
        }, (errors, result) => {
            if(errors) {
                logger.error('Can not get node info from Redis', {error});
                process.exit(1)
            }

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

            let isMaster = !scope.nodeList.length;

            scope.nodeList.push(scope.nodeName);
            scope.nodeInfo[scope.nodeName] = isMaster;
            console.log(scope.nodeInfo);
            async.series([
                callback => scope.publisher.set('nodelist', JSON.stringify(scope.nodeList), callback),
                callback => scope.publisher.set('nodeinfo', JSON.stringify(scope.nodeInfo), callback),
                callback => {
                    if(isMaster) {
                        logger.info('start message generator');
                        return this.messageGenerator.startSendMessages(callback);
                    }
                    console.log('start message listener');
                    console.log('new node');
                    scope.publisher.publish('newnode', JSON.stringify({node: scope.nodeName}));
                    callback(null);
                }
            ], (error, result) => {
                if(error) {
                    logger.info('Error on start', {error})
                    process.exit(0);
                }
                callback(null);


            });
        })
    }

    getClosestNode() {
        let nodeList = this.scope.nodeList,
            nodeName = this.scope.nodeName;
        let myIndex = _.indexOf(nodeList, nodeName);
        return myIndex + 1 == nodeList.length ? nodeList[0] : nodeList[myIndex + 1];
    }

    watchClosestNodeStatus() {
        this.messageEmitter.subscribe([`${this.scope.nodeName}:pong`], () => {
            async.forever(this._tryToPingNextNode.bind(this))
        });
    }

    deleteNodeAndSyncAllNodes(deletedNode, callback) {
        let scope = this.scope,
            publisher = scope.publisher,
            logger = scope.logger,
            nodeName = scope.nodeName,
            isMaster = false;
        scope.nodeList = _.without(scope.nodeList, deletedNode);


        if(scope.nodeInfo[deletedNode]) {
            isMaster = scope.nodeInfo[nodeName] = true;
            logger.info(`I am  new master: ${nodeName}`);
        }
        delete scope.nodeInfo[deletedNode]; //check if nextNode is master
        async.parallel([
            callback => publisher.set('nodelist', JSON.stringify(scope.nodeList), callback),
            callback => publisher.set('nodeinfo', JSON.stringify(scope.nodeInfo), callback),
            callback => {
                publisher.publish(`updatenodelist`, JSON.stringify({
                    node: nodeName,
                    nodeList: scope.nodeList,
                    nodeInfo: scope.nodeInfo
                }));
                if(isMaster) {
                    return this.messageGenerator.startSendMessages(callback);
                }
                return callback(null);
            }]
            , (errors, result) => {
                if(errors) {
                    logger.error('error on reinit nodes', error);
                }
                callback(null);
        });
    }

    _tryToPingNextNode(next) {
        console.log('try to ping next node');
        let scope = this.scope,
            nodeName = scope.nodeName,
            publisher = scope.publisher,
            messageEmitter = this.messageEmitter,
            pingInterval = this.pingInterval;

        let nextNode = this.getClosestNode();
        if(nextNode === nodeName) {
            setTimeout(next, pingInterval);
        } else {
            let onPongCallback = () => {
                clearTimeout(nextNodePingTimeout);
                setTimeout(next, pingInterval);
            };
            let nextNodePingTimeout = setTimeout(() => {
                console.log('node dead', nextNode);
                messageEmitter.removeListener(`${nodeName}:pong`,onPongCallback);

                this.deleteNodeAndSyncAllNodes(nextNode, next);
            }, pingInterval);
            console.log('ping node', nextNode);
            messageEmitter.once(`${nodeName}:pong`, onPongCallback);
            publisher.publish(`${nextNode}:ping`, JSON.stringify({node: nodeName}));
        }
    }
}
