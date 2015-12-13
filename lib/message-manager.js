'use strict';


module.exports = class MessageManager {

    constructor(scope) {
        this.scope = scope;
        this.logger = scope.logger;
    }

    ping(message) {
        let nodeName = this.scope.nodeName;
        this.scope.publisher.publish(`${message.node}:pong`, JSON.stringify({node: nodeName}));
        this.logger.trace('pong from node', nodeName);
    }
    eventHandler(msg, callback){
        function onComplete(){
            var error = Math.random() > 0.85;
            callback(error, msg);
        }
        // processing takes time...
        setTimeout(onComplete, Math.floor(Math.random()*1000));
    }

    message(messageObject) {
        let scope = this.scope,
            publisher = scope.publisher;

        let onProcess = () => {
            this.scope.publisher.publish(`${messageObject.node}:recieved`, JSON.stringify({node: this.scope.nodeName}));
        }

        this.logger.info(`receive message from ${messageObject.node} :`, messageObject.message)

        this.eventHandler(messageObject.message, (error, message) => {
            if(error) {
                this.logger.warn(`error on processing received message: ${message}`)
                publisher.rpush('errorqueue', message, () => {
                    onProcess();
                });
            } else {
                onProcess();
                this.logger.info(`message processed successfully: ${message}`)
            }
        });
    }

    newNode(message) {
        this.scope.nodeList.push(message.node);
        this.scope.nodeInfo[message.node] = 0;
        this.logger.info('registered new node. Node List Now', this.scope.nodeList)
    }


    kill(message) {
        this.logger.info('Recieved kill message. Shutdown');
        process.exit(0);
    }

    updateNodeList(message) {
        this.scope.nodeList = message.nodeList;
        this.scope.nodeInfo = message.nodeInfo;
        this.logger.info('update node list', this.scope.nodeInfo);
    }

}
