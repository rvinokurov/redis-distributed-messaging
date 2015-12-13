'use strict';
const redis = require('redis');
const config = require('../config.json').redis;

let redisClients = {}





const getConnection = (type, callback) => {
    if(!redisClients[type]) {
        redisClients[type] = redis.createClient(config);
        redisClients[type].select(config.database, (error, result) => {
            callback(error, redisClients[type]);
        });
    } else {
        callback(null, client);
    }


};

module.exports =  {
    getConnection
}
