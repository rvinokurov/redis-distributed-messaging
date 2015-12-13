# redis-distributed-messaging

Sample of distributed messaging system based on Redis pub/sub
Developed and tested on Node 5.1.0.

## Installation

```
git clone git@github.com:rvinokurov/redis-distributed-messaging.git
cd redis-distributed-messaging
npm i
```

Entire log's output presents  in bunyan format, so you need to install bunyan globally:
```
npm i -g bunyan 
```

## usage

First, start master node. `--flush` option clears all info about running nodes in redis and kills all running nodes:
```
node app.js --flush | bunyan
```

Then, add some count of listener nodes by running next command several times:
```
node app.js | bunyan
```

### clear error queue:
```
node app.js --getErrors | bunyan
```

## Config sections and options:

* redis - redis connection parameters
* MessageGenerator
  * sendInterval - interval to send stub messages
  * deliveryTimeoutTime - Time to wait delivery message response from node, On timeout node marked as dead and deletes from node list
  * sendNextMessageOnDelivery - if true, next message sends when delivery response recieved on timeout. Otherwise each next message sends on fixed interval `sendInterval`
* NodeManager
  * pingInterval - fixed interval to send `ping` to closest next node. Each node ping next node clockwise
* clearErrorQueue
  * concurrency - number of parallel LPOP requests to redis
* MessageEmitter
  * maxListeners - number of maxListeners on each channel. Best value depends on setInterval value and listener nodes count


## TODO
* Migrate to Babel
* Use `Promise` (Bluebird) instead `async` module and ES7 `async/await`
* Add comments all public methods
* Add unit tests, using Mocha test framework, Chai, Sinon
* Add highload benchmarks

