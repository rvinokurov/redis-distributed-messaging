'use strict';

const async = require('async');
const _ = require('underscore');

module.exports = class MessageManager {

    constructor(scope, messageEmitter) {
        this.scope = scope;
        this.logger = scope.logger;
        this.scope.nodeList = [];
        this.scope.nodeInfo = {};
        this.messageEmitter = messageEmitter;
    }

    init(callback) {
        let scope = this.scope,
            logger = scope.logger;
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
            console.log(scope.nodeInfo);
            scope.publisher.set('nodelist', JSON.stringify(scope.nodeList));
            scope.publisher.set('nodeinfo', JSON.stringify(scope.nodeInfo));
            callback(error);
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

    _tryToPingNextNode(next) {
        let scope = this.scope,
            nodeName = scope.nodeName,
            nodeList = scope.nodeList,
            nodeInfo = scope.nodeInfo,
            publisher = scope.publisher,
            messageEmitter = this.messageEmitter;

        let nextNode = this.getClosestNode();
        if(nextNode === nodeName) {
            setTimeout(next, 1000);
        } else {
            let nextNodePingTimeout = setTimeout(() => {
                console.log('node dead', nextNode);
                nodeList = _.without(nodeList, nextNode);
                if(nodeInfo[nextNode]) {
                    nodeInfo[nodeName] = true;
                    logger.info(`new master is ${nodeName}`);
                    //start broadcast
                }
                delete nodeInfo[nextNode]; //check if nextNode is master

                console.log('current node list', nodeList);
                publisher.set('nodelist', JSON.stringify(nodeList));
                publisher.set('nodeinfo', JSON.stringify(nodeInfo));
                publisher.publish(`updatenodelist`, JSON.stringify({nodeList, nodeInfo}));
                next(null);
            }, 1000);
            console.log('ping node', nextNode);
            messageEmitter.once(`${nodeName}:pong`, () => {
                clearTimeout(nextNodePingTimeout);
                setTimeout(next, 1000);
            });
            publisher.publish(`${nextNode}:ping`, JSON.stringify({node: nodeName}));
        }
    }
}
