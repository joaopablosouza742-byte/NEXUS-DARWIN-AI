const https = require('https');
const crypto = require('crypto');

const API_KEY = 'r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB';
const API_SECRET = 'aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn';

function bRequest(path, params = {}) {
  return new Promise((resolve, reject) => {
    params.timestamp = Date.now();
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const signature = crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex');
    const fullQs = `${qs}&signature=${signature}`;
    const opts = {
      hostname: 'api.binance.com',
      port: 443,
      path: `${path}?${fullQs}`,
      method: 'GET',
      headers: { 'X-MBX-APIKEY': API_KEY }
    };
    https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject).end();
  });
}

bRequest('/sapi/v1/account/apiRestrictions').then(r => {
  console.log('=== RESTRIÇÕES E PERMISSÕES DA CHAVE BINANCE ===');
  console.log(JSON.stringify(r, null, 2));
}).catch(console.error);
