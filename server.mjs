import http from 'node:http';
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', source: 'dockerfile-runtime', marker: null }));
});
server.listen(process.env.PORT || 8080, () => console.log('listening'));
