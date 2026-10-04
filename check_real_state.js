const crypto = require('crypto');
const https = require('https');

const API_KEY = process.env.BINANCE_API_KEY || 'r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB';
const API_SECRET = process.env.BINANCE_API_SECRET || 'aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn';

function req(path) {
  return new Promise((resolve, reject) => {
    const ts = Date.now();
    const sep = path.includes('?') ? '&' : '?';
    const q = 'timestamp=' + ts;
    const fullPathBeforeSig = path + sep + q;
    const queryToSign = fullPathBeforeSig.split('?')[1];
    const sig = crypto.createHmac('sha256', API_SECRET).update(queryToSign).digest('hex');
    const fullUrl = fullPathBeforeSig + '&signature=' + sig;

    const opt = {
      hostname: 'api.binance.com',
      path: fullUrl,
      headers: { 'X-MBX-APIKEY': API_KEY }
    };
    https.get(opt, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch(e) {
          resolve(d);
        }
      });
    }).on('error', reject);
  });
}

function getPrices() {
  return new Promise((resolve) => {
    https.get('https://api.binance.com/api/v3/ticker/price?symbols=%5B%22SOLBRL%22,%22ETHBRL%22%5D', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(JSON.parse(d)));
    });
  });
}

(async () => {
  const acc = await req('/api/v3/account');
  const balances = (acc.balances || []).filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  console.log('REAL BALANCES ON BINANCE:');
  console.log(JSON.stringify(balances, null, 2));

  const prices = await getPrices();
  console.log('CURRENT BINANCE PRICES:');
  console.log(JSON.stringify(prices, null, 2));

  // Check last orders
  const solOrders = await req('/api/v3/allOrders?symbol=SOLBRL&limit=5');
  console.log('LAST 5 SOL ORDERS:');
  console.log(JSON.stringify(solOrders, null, 2));
})();
