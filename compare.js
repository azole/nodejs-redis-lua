/*jslint node: true */
'use strict';

var async = require('async'),
  redis = require('redis');
var client = redis.createClient();

var limit = 20001;
var timer1, timer2;

async.times(limit, function(n, next) {
  client.hset('job:' + n, 'duration', Math.floor(Math.random() * limit), next);
}, function(err, jobs) {
  if (err) {
    console.log(err);
  } else {
    console.log('create jobs successfully');
    testByJS();
  }
});

function testByJS() {
  var sum = 0;
  var start = new Date().getTime();
  var n = limit;

  for (var i = 0; i < limit; i++) {
    client.hget('job:' + i, 'duration', function(err, duration) {
      sum += parseInt(duration, 10);
      if (--n <= 0) {
        var end = new Date().getTime();
        console.log('JS result:', sum, 'duration:', end - start);
      }
    });
  }

  timer1 = setTimeout(testByLua, 1000);

}

function testByLua() {
  var sum = 0;

  var luaScript = '\
   local sum = 0 \
   for i = 0, 20000, 1 do \
     local key = "job:" .. i \
     local ms = tonumber(redis.call("hget", key, "duration")) \
     if ms == nil then return { err = key .. " is not an integer" } end \
     sum = sum + ms \
   end \
   return sum';

  var start = new Date().getTime();
  client.eval(luaScript, 0, function(err, sum) {
    if (err)
      throw err;
    var end = new Date().getTime();
    console.log('Lua result:', sum, 'duration:', end - start);
  });
  timer2 = setTimeout(testByJS, 500);
}

process.on('SIGINT', function() {
  if (timer1)
    clearTimeout(timer1);
  if (timer2)
    clearTimeout(timer2);

  var deleteLuaScript = '\
     local sum = 0 \
     for i = 0, ARGV[1], 1 do \
       local key = "job:" .. i \
       redis.call("del", key) \
     end \
     return 1';

  client.eval(deleteLuaScript, 0, limit - 1, function(err, result) {
    if (err) throw err;
    console.log('quit redis');
    client.quit();
  });
});
