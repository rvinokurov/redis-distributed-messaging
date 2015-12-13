'use strict';


module.exports = class MessageManager {

    constructor(scope) {
        this.scope = scope;
        this.logger = scope.logger;
    }

    ping(processPingMessage) {
        let nodeName = this.scope.nodeName;
        this.scope.publisher.publish(`${message.node}:pong`, JSON.stringify({node: nodeName}));
        console.log('pong from node', nodeName);
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
        console.log('update node list', this.scope.nodeInfo);
    }

}
