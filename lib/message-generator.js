'use strict';

const async = require('async');
const _ = require('underscore');

module.exports = class MessageGenerator {
    constructor(scope, nodeManager, messageEmitter) {
        this.scope = scope;
        this.currentNode = 0;
        this.sendInterval = 500;
        this.deliveryTimeoutTime = 2000;
        this.nodeManager = nodeManager;
        this.messageEmitter = messageEmitter;
        this.lastDeliveryFailed = true;
        this.lastMessage = null;
        this.logger = scope.logger;
        this.sendNextMessageOnDelivery = false;
    }

    getMessage() {
        this.cnt = this.cnt || 0;
        return this.cnt++;
    }

    sendMessage(next) {
        let nextNode = this.getNextNode(),
            messageEmitter = this.messageEmitter,
            nodeName = this.scope.nodeName,
            publisher = this.scope.publisher;

        let goNext = () => {}
        if(next) {
            goNext = () => {
                setTimeout(next, this.sendInterval);
            };
        }

        next = next || () => {};

        if(!nextNode) {
            return goNext();
        }

        if(!this.lastDeliveryFailed || !this.lastMessage) {
            this.lastMessage = this.getMessage();
        }
        this.lastDeliveryFailed = false;


        let onDeliveryCallback = () => {
            clearTimeout(deliveryTimeout);
            goNext();
        };

        let deliveryTimeout = setTimeout(() => {
            this.logger.trace('node dead on delivery', nextNode);
            messageEmitter.removeListener(`${nodeName}:recieved`,onDeliveryCallback);
            this.lastDeliveryFailed = true;
            this.nodeManager.deleteNodeAndSyncAllNodes(nextNode, next);
        }, this.deliveryTimeoutTime);

        this.logger.info(`send message ${this.lastMessage}:`, nextNode);
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
        if(this.currentNode >= nodeList.length) {
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
                if(this.sendNextMessageOnDelivery) {
                    async.forever(this.sendMessage.bind(this));
                } else {
                    setInterval(this.sendMessage.bind(this), this.sendInterval)
                }

            });
            callback(null);
        });


    }
}
