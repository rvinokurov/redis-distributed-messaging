'use strict';

const async = require('async');
const _ = require('underscore');

module.exports = class MessageGenerator {
    constructor(scope, nodeManager, messageEmitter) {
        this.scope = scope;
        this.currentNode = 0;
        this.sendInterval = 1;
        this.deliveryTimeoutTime = 500;
        this.nodeManager = nodeManager;
        this.messageEmitter = messageEmitter;
        this.lastDeliveryFailed = true;
        this.lastMessage = null;
    }

    getMessage() {
        this.cnt = this.cnt || 0;
        return this.cnt++;
    }

    sendMessage(next, status) {
        let nextNode = this.getNextNode(),
            messageEmitter = this.messageEmitter,
            nodeName = this.scope.nodeName,
            publisher = this.scope.publisher;

        if(!nextNode) {
            return setTimeout(next, this.sendInterval);
        }

        if(!this.lastDeliveryFailed || !this.lastMessage) {
            this.lastMessage = this.getMessage();
        }
        this.lastDeliveryFailed = false;


        let onDeliveryCallback = () => {
            clearTimeout(deliveryTimeout);
            setTimeout(next, this.sendInterval);
        };

        let deliveryTimeout = setTimeout(() => {
            logger.trace('node dead on delivery', nextNode);
            messageEmitter.removeListener(`${nodeName}:recieved`,onDeliveryCallback);
            this.lastDeliveryFailed = true;
            this.nodeManager.deleteNodeAndSyncAllNodes(nextNode, next);
        }, this.deliveryTimeoutTime);

        logger.info(`send message ${this.lastMessage}:`, nextNode);
        messageEmitter.once(`${nodeName}:recieved`, onDeliveryCallback);
        publisher.publish(`${nextNode}:message`, JSON.stringify({node: nodeName, message: this.lastMessage}));
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
