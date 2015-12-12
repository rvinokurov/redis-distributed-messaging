'use strict';
const redis = require('redis');

let redisClient = null;

const connectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
};


const getConnection = () => {
    // if(!redisClient)  {
    //     redisClient = redis.createClient(connectionOptions);
    // }
    // return redisClient;
    return redis.createClient(connectionOptions);
};

module.exports =  {
    getConnection
}
