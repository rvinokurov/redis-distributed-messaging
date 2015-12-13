'use strict';

const async = require('async');
const _ = require('underscore');

module.exports = class MessageGenerator {
    constructor(scope, nodeManager, messageEmitter) {
        this.scope = scope;
        this.currentNode = 0;
        this.sendInterval = 500;
        this.nodeManager = nodeManager;
        this.messageEmitter = messageEmitter;
    }

    getMessage() {
        this.cnt = this.cnt || 0;
        return this.cnt++;
    }

    sendMessage(next) {
        let nextNode = this.getNextNode(),
            message = null,
            messageEmitter = this.messageEmitter,
            nodeName = this.scope.nodeName,
            publisher = this.scope.publisher;

        if(!nextNode) {
            return setTimeout(next, this.sendInterval);
        }

        message = this.getMessage();

        let onDeliveryCallback = () => {
            clearTimeout(deliveryTimeout);
            setTimeout(next, this.sendInterval);
        };

        let deliveryTimeout = setTimeout(() => {
            console.log('node dead on delivery', nextNode);
            messageEmitter.removeListener(`${nodeName}:recieved`,onDeliveryCallback);
            this.nodeManager.deleteNodeAndSyncAllNodes(nextNode, next);
        }, this.sendInterval);

        console.log('send message', nextNode);
        messageEmitter.once(`${nodeName}:recieved`, onDeliveryCallback);
        publisher.publish(`${nextNode}:message`, JSON.stringify({node: nodeName, message: message}));
    }

    getNextNode() {
        let scope = this.scope,
            nodeList = scope.nodeList,
            nodeName = scope.nodeName;
        if(nodeList.length < 2) {
            return null;
        }

        this.currentNode++;
        if(this.currentNode === nodeList.length) {
            this.currentNode = 0;
        }
        if(nodeList[this.currentNode] === scope.nodeName) {
            return this.getNextNode();
        }
        return nodeList[this.currentNode];
    }

    startSendMessages(callback) {
        this.scope.publisher.get('currentCounter', (error, counter) => {
            if(error) {
                this.cnt = 0
            }
            if(!counter)  {
                this.cnt = 0;
            }

            this.messageEmitter.subscribe([`${this.scope.nodeName}:recieved`], () => {
                async.forever(this.sendMessage.bind(this));
            });
            callback(null);
        });


    }
}
