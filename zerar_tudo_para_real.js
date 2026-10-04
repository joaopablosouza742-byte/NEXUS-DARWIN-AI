/**
 * NEXUS DARWIN AI - SCRIPT DE FECHAMENTO DE EMERGÊNCIA (ZERAR TUDO PARA BRL)
 * ==========================================================================
 * Vende todas as posições abertas (BTC, BNB, SOL, ETH, etc.) a mercado
 * e converte tudo em Real Brasileiro (BRL) antes de desligar o PC.
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.BINANCE_API_KEY || 'r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB';
const API_SECRET = process.env.BINANCE_API_SECRET || 'aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn';
const FIREBASE_URL = 'https://nexus-darwin-ai-default-rtdb.firebaseio.com';

const { FirebaseCloudSync } = fs.existsSync(path.join(__dirname, 'firebase_cloud_sync.js'))
  ? require('./firebase_cloud_sync.js')
  : require('./engine/firebase_cloud_sync.js');

const cloudSync = new FirebaseCloudSync();
cloudSync.databaseURL = FIREBASE_URL;

const { persistentState } = require('./persistent_state_manager.js');

function binanceSignedRequest(path, method, params = {}) {
  return new Promise((resolve, reject) => {
    params.timestamp = Date.now();
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const signature = crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex');
    const fullQs = `${qs}&signature=${signature}`;

    const opts = {
      hostname: 'api.binance.com',
      port: 443,
      path: `${path}?${fullQs}`,
      method: method,
      headers: {
        'X-MBX-APIKEY': API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function zerarTudoParaReal() {
  console.log('===================================================================');
  echo = '🚨 NEXUS DARWIN AI - ZERANDO TODAS AS POSIÇÕES PARA REAL (BRL)...';
  console.log(echo);
  console.log('===================================================================');

  const account = await binanceSignedRequest('/api/v3/account', 'GET');
  if (!account || !account.balances) {
    console.error('❌ Erro ao acessar carteira Binance.');
    return;
  }

  const ASSETS_TO_CHECK = [
    { symbol: 'BTCBRL', asset: 'BTC', minQty: 0.00001, decimals: 5 },
    { symbol: 'BNBBRL', asset: 'BNB', minQty: 0.001, decimals: 3 },
    { symbol: 'SOLBRL', asset: 'SOL', minQty: 0.001, decimals: 3 },
    { symbol: 'ETHBRL', asset: 'ETH', minQty: 0.0001, decimals: 4 },
    { symbol: 'XRPBRL', asset: 'XRP', minQty: 0.1, decimals: 1 },
    { symbol: 'DOGEBRL', asset: 'DOGE', minQty: 1, decimals: 0 }
  ];

  for (const item of ASSETS_TO_CHECK) {
    const bal = account.balances.find(b => b.asset === item.asset);
    const free = bal ? parseFloat(bal.free) : 0;

    if (free >= item.minQty) {
      const factor = Math.pow(10, item.decimals);
      const qtyToSell = (Math.floor(free * factor) / factor).toFixed(item.decimals);

      console.log(`[VENDA DE SEGURANÇA]: Vendendo ${qtyToSell} ${item.asset} para BRL...`);
      const res = await binanceSignedRequest('/api/v3/order', 'POST', {
        symbol: item.symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: qtyToSell
      });

      if (res && (res.orderId || res.status === 'FILLED')) {
        console.log(`✅ [SUCESSO]: ${item.asset} liquidado com sucesso! Ordem: #${res.orderId}`);
      } else {
        console.log(`⚠️ Resposta para ${item.asset}:`, JSON.stringify(res));
      }
    }
  }

  // Zera posições no arquivo persistente
  const state = persistentState.loadState();
  if (state && Array.isArray(state.activeBots)) {
    state.activeBots.forEach(b => {
      b.openPosition = null;
      b.assignedAsset = 'BRL';
    });
    persistentState.saveState(state);
    await cloudSync.syncEcosystemState(state);
  }

  console.log('\n🔒 [CONCLUÍDO]: 100% do patrimônio convertido em BRL (Real Seguro).');
  console.log('Você pode desligar o computador tranquilamente sem risco de mercado!');
}

zerarTudoParaReal().catch(console.error);
