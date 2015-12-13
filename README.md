# redis-distributed-messaging

Sample of distributed messaging system based on Redis pub/sub
Developed and tested on Node 5.1.0.

## Installation

```
git clone git@github.com:rvinokurov/redis-distributed-messaging.git
cd redis-distributed-messaging
npm i
```

All log's output presents  in bunyan format, so you need to install bunyan globally:
```
npm i -g bunyan 
```

## usage

First, start master node. `--flush` option clears all info about runned nodes in redis and kills all runned nodes:
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

## TODO
* Migrate to Babel
* Use Promise instead async module and ES7 async/await
* Add comments all public methods
* Add unit tests, using Mocha test framework, Chai, Sinon
* Add highload benchmarks

