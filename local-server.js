#!/usr/bin/env node
/**
 * 零依赖本地数据服务器（增强版保留）
 * - 静态托管本目录
 * - GET/POST /api/data → local-data.json
 * - GET /api/health
 * 默认 http://localhost:3456
 */
var http = require('http');
var fs = require('fs');
var path = require('path');
var { exec } = require('child_process');

var ROOT = __dirname;
var DATA_FILE = path.join(ROOT, 'local-data.json');
var PORT = Number(process.env.PORT || 3456);

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  var filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden', 'text/plain');
    return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) {
      send(res, 404, 'Not Found', 'text/plain');
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

var server = http.createServer(function (req, res) {
  var url = (req.url || '').split('?')[0];
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }
  if (url === '/api/health') {
    send(res, 200, JSON.stringify({ ok: true, port: PORT }));
    return;
  }
  if (url === '/api/data' && req.method === 'GET') {
    fs.readFile(DATA_FILE, 'utf8', function (err, text) {
      if (err) {
        send(res, 200, JSON.stringify({ ok: true, data: null }));
        return;
      }
      try {
        send(res, 200, JSON.stringify({ ok: true, data: JSON.parse(text) }));
      } catch (e) {
        send(res, 200, JSON.stringify({ ok: true, data: null }));
      }
    });
    return;
  }
  if (url === '/api/data' && req.method === 'POST') {
    readBody(req).then(function (raw) {
      var payload;
      try {
        payload = JSON.parse(raw || '{}');
      } catch (e) {
        send(res, 400, JSON.stringify({ ok: false, error: 'invalid json' }));
        return;
      }
      fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), function (err) {
        if (err) {
          send(res, 500, JSON.stringify({ ok: false, error: String(err.message || err) }));
          return;
        }
        send(res, 200, JSON.stringify({ ok: true }));
      });
    }).catch(function (e) {
      send(res, 500, JSON.stringify({ ok: false, error: String(e.message || e) }));
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, function () {
  var url = 'http://localhost:' + PORT;
  console.log('OPC workbench local-server listening on ' + url);
  console.log('Data file: ' + DATA_FILE);
  var openCmd =
    process.platform === 'darwin' ? 'open ' + url :
    process.platform === 'win32' ? 'start ' + url :
    'xdg-open ' + url;
  exec(openCmd, function () {});
});
