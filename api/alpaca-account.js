/**
 * Vercel Serverless Function: /api/alpaca-account
 * Consulta saldo real, posições e ordens do Paper Trading da Alpaca Markets.
 */

const https = require('https');

const DEFAULT_KEY = process.env.ALPACA_API_KEY || 'PK5WU4MBN5X5QOHZFRGNXBWMDA';
const DEFAULT_SECRET = process.env.ALPACA_API_SECRET || 'GfC4EWSUuf5zmVV2VUtEPtrjcXmeaBFt9puGoLoDXhtx';

function alpacaGet(path, apiKey, apiSecret) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'paper-api.alpaca.markets',
      path,
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json'
      },
      timeout: 6000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout Alpaca API')); });
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const apiKey = (req.query && req.query.apiKey) || DEFAULT_KEY;
    const apiSecret = (req.query && req.query.apiSecret) || DEFAULT_SECRET;

    const [account, positions, orders] = await Promise.all([
      alpacaGet('/v2/account', apiKey, apiSecret).catch(() => null),
      alpacaGet('/v2/positions', apiKey, apiSecret).catch(() => []),
      alpacaGet('/v2/orders?status=all&limit=20', apiKey, apiSecret).catch(() => [])
    ]);

    res.status(200).json({
      success: true,
      account: account || {},
      positions: Array.isArray(positions) ? positions : [],
      orders: Array.isArray(orders) ? orders : []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
