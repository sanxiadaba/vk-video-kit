# code/http

这两个文件是从一次真实的 HTTP 往返里抓下来的，不是手写的：

```js
const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': '5' });
  res.end('hello');
});
// 起服务后，用 net.connect 发一条原始请求，把收到的字节原样存下来
```

- `response.txt`：原始响应（CRLF 换成 LF 便于展示），134 字节
- `head.bin`：响应的前 16 字节 —— `HTTP/1.1 200 OK`

重新抓一次就会得到新的 `Date`，所以这两个文件按"某一次真实快照"看待。
