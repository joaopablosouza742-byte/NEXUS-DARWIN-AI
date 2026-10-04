/**
 * Vercel Serverless Function: /api/alpaca-order
 * Executa ordens de Ações Fracionadas na Bolsa Americana (NYSE / NASDAQ via Alpaca Markets).
 */

const { executeAlpacaUSStockOrder } = require('../server.js');

const DEFAULT_KEY = process.env.ALPACA_API_KEY || 'PK5WU4MBN5X5QOHZFRGNXBWMDA';
const DEFAULT_SECRET = process.env.ALPACA_API_SECRET || 'GfC4EWSUuf5zmVV2VUtEPtrjcXmeaBFt9puGoLoDXhtx';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const params = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const apiKey = params.apiKey || DEFAULT_KEY;
    const apiSecret = params.apiSecret || DEFAULT_SECRET;

    const result = await executeAlpacaUSStockOrder({
      apiKey,
      apiSecret,
      isPaper: params.isPaper !== false,
      symbol: params.symbol || 'AAPL',
      side: params.side || 'buy',
      notionalUsd: params.notionalUsd || 10
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
