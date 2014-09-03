nodejs-redis-lua
================

Redis Lua Scripting in Nodejs

用 redis 儲存資料時，時常會遇到的一個情況是，要對 redis 連續下多次指令，這時候，每下一個指令就是一次的網路傳輸，當指令較多且執行頻繁時，將會影響效能，這時候就可以利用 lua 編寫 script，將一組指令一次執行完畢。

如果遇到這個 script 比較大時，網路傳輸量也會變大，這時候還可以將 lua script 先 load 進 redis，redis 會回覆一個 SHA，之後要在重複執行這個 script 時，僅需要傳輸這個 SHA 與相關參數即可。

這邊做兩個範例，一個是 nodejs 如何操作 lua script，基礎的部分就不再說明。

另外一個則是效能的比較。

範例是修改自這篇文章：<a href="http://tjholowaychuk.tumblr.com/post/19321054250/redis-lua-scripting-is-badass" target="_blank">http://tjholowaychuk.tumblr.com/post/19321054250/redis-lua-scripting-is-badass</a>

每個範例都會在一開始的時候，建立 20000 個 hash，key 為 job:0 ~ job: 20000，裡頭有一個欄位是 duration，存一個隨機的數字。

每個範例在結束時，都會刪除掉為了測試所建立的資料。

範例1: demo.js

建立 lua script: 這邊有用到一個參數 ARGV[1]，要留意的是這邊是由 1 開始。
```
var luaScript = '\
 local sum = 0 \
 for i = 0, ARGV[1], 1 do \
   local key = "job:" .. i \
   local ms = tonumber(redis.call("hget", key, "duration")) \
   if ms == nil then return { err = key .. " is not an integer" } end \
   sum = sum + ms \
 end \
 return sum';
```

執行 lua script: redisClient.eval(script, numkeys [,key...] [, ars...], callback)
```
redisClient.eval(script, 0, argv1, function(err, result) {});
```

載入 lua script: 這邊會取得一個 SHA，要保存起來。
```
redisClient.script('load', luaScript, function(err, sha) {
  console.log('get lua script sha:' + sha);
});
```

確認是否有成功載入：
```
redisClient.script('exists', sha, function(err, result) {});
```

執行 SHA lua script: 幾乎跟直接執行 script 的 eval 一樣，唯一的差別是傳入的是 SHA。
```
redisClient.evalsha(sha, 0, argv1, function(err, result) {});
```

範例2: 效能比較

這邊會將建立的 20000 組 job 中的 duration 加總起來，分別用 js 去跑迴圈加總、用 lua script 去執行，分別執行 5 次的結果如下，可以看到 lua script 快了大約 8 ~ 9 倍左右！

JS result: 200347421 duration: 549           
Lua result: 200347421 duration: 60           

JS result: 200347421 duration: 518           
Lua result: 200347421 duration: 63           

JS result: 200347421 duration: 513           
Lua result: 200347421 duration: 62           

JS result: 200347421 duration: 565           
Lua result: 200347421 duration: 57           

JS result: 200347421 duration: 524           
Lua result: 200347421 duration: 68           

以上的結果是加總 20000 個 hash 欄位的結果，js 的部份會做 20000 次的網路傳輸，所以差距頗大，那如果只做 3 次指令傳輸的指令呢？其結果如下，沒有什麼差別。

JS result: 39581 duration: 1           
Lua result: 39581 duration: 1           

JS result: 39581 duration: 0           
Lua result: 39581 duration: 1           
           
JS result: 39581 duration: 1           
Lua result: 39581 duration: 1           

以這個範例來說，大約要到 30 個指令傳輸以上才會有一點點差距。


<a href="http://tjholowaychuk.tumblr.com/post/19321054250/redis-lua-scripting-is-badass" target="_blank">http://www.oschina.net/translate/intro-to-lua-for-redis-programmers</a>

<a href="http://tjholowaychuk.tumblr.com/post/19321054250/redis-lua-scripting-is-badass" target="_blank">http://tjholowaychuk.tumblr.com/post/19321054250/redis-lua-scripting-is-badass</a>
