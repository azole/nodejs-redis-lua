/*jslint node: true */
'use strict';

var async = require('async'),
  redis = require('redis');
var client = redis.createClient();

// script flush: remove all lua scripts

var limit = 20001;

async.times(limit, function(n, next) {
  // create demo jobs
  client.hset('job:' + n, 'duration', Math.floor(Math.random() * limit), next);
}, function(err, jobs) {
  if (err) {
    console.log(err);
  } else {
    console.log('create jobs successfully');
    execLuaScript(luaScript, limit-1);
    loadLuaScript();
  }
});

var luaScript = '\
   local sum = 0 \
   for i = 0, ARGV[1], 1 do \
     local key = "job:" .. i \
     local ms = tonumber(redis.call("hget", key, "duration")) \
     if ms == nil then return { err = key .. " is not an integer" } end \
     sum = sum + ms \
   end \
   return sum';

function loadLuaScript() {
  client.script('load', luaScript, function(err, sha) {
    console.log('get lua script sha:' + sha);
    checkLoadScript(sha);
  });
}

function checkLoadScript(sha) {
  client.script('exists', sha, function(err, result) {
    if (err) throw err;
    console.log('checkLoadScript:', result);
    if (result[0] === 1) {
      execLuaScriptSha(sha);
    }
  });
}

function execLuaScript(script, argv1, cb) {
  client.eval(script, 0, argv1, function(err, result) {
    if (err) throw err;
    console.log('execLuaScript:', result);
    if(cb) {
      cb();
    }
  });
}

function execLuaScriptSha(sha) {
  client.evalsha(sha, 0, limit - 1, function(err, result) {
    if (err) throw err;
    console.log('execLuaScriptSha:', result);
  });
}

process.on('SIGINT', function() {
  var deleteLuaScript = '\
     local sum = 0 \
     for i = 0, ARGV[1], 1 do \
       local key = "job:" .. i \
       redis.call("del", key) \
     end \
     return 1';

  execLuaScript(deleteLuaScript, limit - 1, function() {
    console.log('quit redis');
    client.quit();
  });
});
