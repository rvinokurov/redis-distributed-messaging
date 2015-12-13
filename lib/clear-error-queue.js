'use strict';
const async = require('async');


const config = require('../config.json').clearErrorQueue;


const popConcurrency = config.concurrency || 10;


const popErrorQueue = (task, callback) => {
    task.publisher.lpop('errorqueue', (error, result) => {
        if (error) {
            logger.error('error on pop value from errorqueue', error);
        }
        task.lastResult = result;
        if(result) {
            task.logger.info(`Got message from errorqueue: ${result}`);
        }

        callback();
    });
};

module.exports = (scope, callback) => {
    let task = {
        publisher: scope.publisher,
        lastResult: true,
        logger: scope.logger
    };

    let q = async.queue(popErrorQueue, popConcurrency);
    q.drain = () => {
        callback();
    }
    async.whilst(
        () => task.lastResult,
        callback => q.push(task, () =>{
            callback();
        }),
        function (err, n) {}
    );
};
