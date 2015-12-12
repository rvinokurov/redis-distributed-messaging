'use strict';
const redis = require('redis');

let redisClients = {}



const connectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    database: process.env.REDIS_DATABASE || 1
};


const getConnection = (type, callback) => {
    if(!redisClients[type]) {
        redisClients[type] = redis.createClient(connectionOptions);
        redisClients[type].select(connectionOptions.database, (error, result) => {
            callback(error, redisClients[type]);
        });
    } else {
        callback(null, client);
    }


};

module.exports =  {
    getConnection
}
