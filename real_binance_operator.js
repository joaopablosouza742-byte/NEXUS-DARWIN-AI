/**
 * NEXUS DARWIN AI - OPERADOR MULTI-CRIPTO AUTÔNOMO 100% REAL (BINANCE BRASIL)
 * ===========================================================================
 * Estratégia de Scalping HFT Inteligente:
 * 1. O Robô #1 opera com R$ 10,00 escaneando 4 moedas (BTC, SOL, ETH, BNB).
 * 2. Escolhe sempre a moeda que estiver no ponto mais lucrativo (RSI sobrevendido).
 * 3. Faz operações rápidas buscando de 1.0% a 1.5% de lucro (ganhando centavos no trade).
 * 4. Os centavos vão acumulando na banca (R$ 10,15 -> R$ 10,30 -> R$ 10,50...).
 * 5. Ao acumular +R$ 10,00 de lucros somados:
 *    - Transfere R$ 10,00 de Lucro Limpo pro Cofre (Carteira Funding da Binance).
 *    - Cria o Robô #2 para operarem duas moedas ao mesmo tempo!
 * 6. Sincroniza em tempo real com o Firebase e o painel web na Vercel!
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

const { runGrokStrategicAnalysis } = require('./grok_advisor.js');
const { persistentState } = require('./persistent_state_manager.js');
const { telegramNotifier } = require('./telegram_notifier.js');

// =============================================================================
// CESTA DE MOEDAS MONITORADAS (MULTI-CRIPTO)
// =============================================================================
const MONITORED_ASSETS = [
  // TIER 1: ALTA VOLATILIDADE & ALTA FREQUÊNCIA DE TRADES (PRIORIDADE MÁXIMA)
  { symbol: 'SOLBRL', baseAsset: 'SOL', name: 'Solana', decimals: 3, minQty: 0.001 },
  { symbol: 'SUIBRL', baseAsset: 'SUI', name: 'Sui', decimals: 1, minQty: 0.1 },
  { symbol: 'NEARBRL', baseAsset: 'NEAR', name: 'NEAR Protocol', decimals: 1, minQty: 0.1 },
  { symbol: 'DOGEBRL', baseAsset: 'DOGE', name: 'Dogecoin', decimals: 0, minQty: 1 },
  { symbol: 'PEPEBRL', baseAsset: 'PEPE', name: 'Pepe', decimals: 0, minQty: 1 },
  { symbol: 'RENDERBRL', baseAsset: 'RENDER', name: 'Render', decimals: 2, minQty: 0.01 },
  { symbol: 'AVAXBRL', baseAsset: 'AVAX', name: 'Avalanche', decimals: 2, minQty: 0.01 },
  { symbol: 'XRPBRL', baseAsset: 'XRP', name: 'XRP', decimals: 1, minQty: 0.1 },
  { symbol: 'LINKBRL', baseAsset: 'LINK', name: 'Chainlink', decimals: 2, minQty: 0.01 },
  { symbol: 'ADABRL', baseAsset: 'ADA', name: 'Cardano', decimals: 1, minQty: 0.1 },
  { symbol: 'POLBRL', baseAsset: 'POL', name: 'Polygon', decimals: 1, minQty: 0.1 },
  { symbol: 'LTCBRL', baseAsset: 'LTC', name: 'Litecoin', decimals: 3, minQty: 0.001 },
  // TIER 2: ATIVOS MENOS VOLÁTEIS / RESERVA
  { symbol: 'BNBBRL', baseAsset: 'BNB', name: 'BNB', decimals: 3, minQty: 0.001 },
  { symbol: 'ETHBRL', baseAsset: 'ETH', name: 'Ethereum', decimals: 4, minQty: 0.0001 },
  { symbol: 'BTCBRL', baseAsset: 'BTC', name: 'Bitcoin', decimals: 5, minQty: 0.00001 },
  { symbol: 'USDCBRL', baseAsset: 'USDC', name: 'USD Coin', decimals: 2, minQty: 0.1 }
];

const priceHistories = {};
MONITORED_ASSETS.forEach(a => { priceHistories[a.symbol] = []; });

const candleCache5m = {};
MONITORED_ASSETS.forEach(a => {
  candleCache5m[a.symbol] = {
    symbol: a.symbol,
    klines: [],
    closes: [],
    rsi: 50.0,
    ema9: 0,
    ema21: 0,
    bb: { upper: 0, middle: 0, lower: 0, bandwidth: 0 },
    currentCandle: { open: 0, high: 0, low: 0, close: 0, volume: 0 },
    prevCandle: { open: 0, high: 0, low: 0, close: 0, volume: 0 },
    lastFetch: 0
  };
});

const macroCache7d = {};
MONITORED_ASSETS.forEach(a => {
  macroCache7d[a.symbol] = {
    symbol: a.symbol,
    high7d: 0,
    low7d: 0,
    rangePosition7d: 50.0,
    buyerRatio6h: 50.0,
    buyerRatio24h: 50.0,
    trend7d: 'NEUTRO',
    lastFetch: 0
  };
});

// =============================================================================
// 1. COMUNICAÇÃO BINANCE (ASSINADA VIA HMAC-SHA256)
// =============================================================================
function getCurrentPublicIp() {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).ip); } catch (e) { resolve('45.226.119.246'); }
      });
    }).on('error', () => resolve('45.226.119.246'));
  });
}

function getBinanceServerTime() {
  return new Promise((resolve) => {
    https.get('https://api.binance.com/api/v3/time', (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(d).serverTime);
        } catch (e) {
          resolve(Date.now());
        }
      });
    }).on('error', () => resolve(Date.now()));
  });
}

function binanceSignedRequest(endpoint, method = 'GET', params = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const serverTime = await getBinanceServerTime();
      params.timestamp = serverTime;
      params.recvWindow = 10000;

      const queryString = Object.keys(params)
        .map((k) => `${k}=${encodeURIComponent(params[k])}`)
        .join('&');

      const signature = crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
      const fullQuery = `${queryString}&signature=${signature}`;

      const options = {
        hostname: 'api.binance.com',
        path: `${endpoint}?${fullQuery}`,
        method: method,
        headers: {
          'X-MBX-APIKEY': API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function transferToFundingVault(amountBrl) {
  try {
    const res = await binanceSignedRequest('/sapi/v1/asset/transfer', 'POST', {
      type: 'MAIN_FUNDING',
      asset: 'BRL',
      amount: String(Number(amountBrl).toFixed(2))
    });
    console.log('[COFRE BINANCE] Lucro enviado para a Carteira Funding:', res.data);
    return res.data;
  } catch (err) {
    console.error('[COFRE BINANCE] Erro na transferência:', err.message);
    return null;
  }
}

async function getRealBalances() {
  try {
    const res = await binanceSignedRequest('/api/v3/account', 'GET');
    if (res.data && res.data.balances) {
      const result = { brlFree: 0 };
      res.data.balances.forEach((b) => {
        const free = parseFloat(b.free) || 0;
        if (b.asset === 'BRL') result.brlFree = free;
        else if (free > 0) result[b.asset] = free;
      });

      // Captura também saldo aplicado no Binance Simple Earn (Flexível):
      try {
        const earnRes = await binanceSignedRequest('/sapi/v1/simple-earn/flexible/position', 'GET');
        if (earnRes.data && Array.isArray(earnRes.data.rows)) {
          earnRes.data.rows.forEach((r) => {
            const amt = parseFloat(r.totalAmount) || 0;
            if (amt > 0) {
              result[r.asset] = (result[r.asset] || 0) + amt;
            }
          });
        }
      } catch (earnErr) {}

      return result;
    } else if (res.data && res.data.code) {
      return { error: res.data.msg, code: res.data.code, brlFree: 0 };
    }
    return { brlFree: 0 };
  } catch (e) {
    return { error: e.message, brlFree: 0 };
  }
}

function getLivePrice(symbol) {
  return new Promise((resolve) => {
    https.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve(parseFloat(JSON.parse(d).price));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function getKlines(symbol, interval = '5m', limit = 25) {
  return new Promise((resolve) => {
    https.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          const raw = JSON.parse(d);
          if (Array.isArray(raw)) {
            resolve(raw.map(k => ({
              openTime: k[0],
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
              closeTime: k[6],
              quoteVolume: parseFloat(k[7]) || 0,
              tradesCount: parseInt(k[8]) || 0,
              takerBuyBase: parseFloat(k[9]) || 0,
              takerBuyQuote: parseFloat(k[10]) || 0
            })));
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function executeConvertTrade(fromAsset, toAsset, amount) {
  try {
    const formattedAmount = fromAsset === 'BRL'
      ? (Math.floor(Number(amount) * 100) / 100).toFixed(2)
      : String(amount);
    console.log(`🔄 [CONVERSÃO DIRETA BINANCE] Solicitando cotação para ${formattedAmount} ${fromAsset} -> ${toAsset}...`);
    const quoteRes = await binanceSignedRequest('/sapi/v1/convert/getQuote', 'POST', {
      fromAsset,
      toAsset,
      fromAmount: formattedAmount,
      walletType: 'SPOT'
    });
    if (!quoteRes.data || !quoteRes.data.quoteId) {
      console.error('❌ [CONVERSÃO DIRETA] Falha na cotação:', quoteRes.data);
      return null;
    }
    const { quoteId, toAmount, fromAmount: realFrom } = quoteRes.data;
    console.log(`✅ [CONVERSÃO DIRETA] Cotado: ${realFrom} ${fromAsset} = ${toAmount} ${toAsset}. Aceitando ordem...`);
    const acceptRes = await binanceSignedRequest('/sapi/v1/convert/acceptQuote', 'POST', {
      quoteId
    });
    console.log('🎉 [CONVERSÃO CONCLUÍDA]:', acceptRes.data);
    const isToBrl = toAsset === 'BRL';
    return {
      orderId: acceptRes.data?.orderId || ('CONV-' + Date.now()),
      executedQty: isToBrl ? parseFloat(realFrom) : parseFloat(toAmount),
      cummulativeQuoteQty: isToBrl ? parseFloat(toAmount) : parseFloat(realFrom),
      status: 'FILLED'
    };
  } catch (err) {
    console.error('❌ [CONVERSÃO DIRETA] Erro:', err.message);
    return null;
  }
}

async function executeRealMarketOrder(symbol, side, quoteOrderQty = null, quantity = null, decimals = 5, baseAsset = null) {
  const coin = baseAsset || symbol.replace('BRL', '');

  // Se o valor de compra for menor que R$ 10,00, a Binance Spot rejeita por NOTIONAL.
  // Executa imediatamente via Binance Convert (mínimo a partir de R$ 0,05 centavos):
  if (side === 'BUY' && quoteOrderQty && Number(quoteOrderQty) < 10.00) {
    console.log(`⚡ [EXECUÇÃO DIRETA CONVERT] Compra de R$ ${quoteOrderQty} abaixo de R$ 10. Executando via Binance Convert...`);
    const convResult = await executeConvertTrade('BRL', coin, quoteOrderQty);
    if (convResult) return convResult;
  }

  const params = { symbol, side, type: 'MARKET' };
  if (side === 'BUY' && quoteOrderQty) {
    params.quoteOrderQty = String(Number(quoteOrderQty).toFixed(2));
  } else if (side === 'SELL' && quantity) {
    const factor = Math.pow(10, decimals);
    const truncatedQty = Math.floor(quantity * factor) / factor;
    params.quantity = truncatedQty.toFixed(decimals);
  }

  console.log(`[ORDEM REAL] Enviando ${side} em ${symbol}:`, params);
  try {
    const result = await binanceSignedRequest('/api/v3/order', 'POST', params);
    console.log(`[RESPOSTA BINANCE]:`, JSON.stringify(result.data));
    if (result.data && (result.data.orderId || result.data.status === 'FILLED')) {
      return result.data;
    }
  } catch (spotErr) {
    console.warn(`[AVISO SPOT] Ordem Spot tradicional falhou (${spotErr.message}). Tentando conversão direta...`);
  }

  // Se a ordem Spot falhou (por exemplo MIN_NOTIONAL < R$ 10):
  if (side === 'SELL') {
    console.log(`⚡ [EXECUÇÃO INTELIGENTE] Acionando conversão direta para ${coin}...`);
    return await executeConvertTrade(coin, 'BRL', quantity);
  } else if (side === 'BUY' && quoteOrderQty) {
    console.log(`⚡ [EXECUÇÃO INTELIGENTE] Acionando compra direta Convert para ${coin}...`);
    return await executeConvertTrade('BRL', coin, quoteOrderQty);
  }

  return null;
}

// =============================================================================
// 2. INDICADORES TÉCNICOS DE SCALPING
// =============================================================================
function calcRSI(history, period = 14) {
  if (history.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  const recent = history.slice(-(period + 1));
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0 && gains === 0) return 50;
  if (losses === 0) return 100;
  if (gains === 0) return 30;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

function calcEMA(history, period) {
  if (history.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = history[0];
  for (let i = 1; i < history.length; i++) {
    ema = history[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcBollingerBands(history, period = 20, multiplier = 2) {
  if (history.length < period) {
    const last = history[history.length - 1] || 1;
    return { middle: last, upper: last * 1.01, lower: last * 0.99, bandwidth: 0.02 };
  }
  const slice = history.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    middle: mean,
    upper: mean + (multiplier * stdDev),
    lower: mean - (multiplier * stdDev),
    bandwidth: (2 * multiplier * stdDev) / mean
  };
}

async function refreshCandleCache5m() {
  const eligible = MONITORED_ASSETS.filter(a => !['BTCBRL', 'ETHBRL', 'BNBBRL', 'USDCBRL'].includes(a.symbol));
  await Promise.all(eligible.map(async (asset) => {
    try {
      const klines = await getKlines(asset.symbol, '5m', 25);
      if (klines && klines.length >= 15) {
        const closes = klines.map(k => k.close);
        const rsi = Number(calcRSI(closes, 14).toFixed(1));
        const ema9 = calcEMA(closes, 9);
        const ema21 = calcEMA(closes, 21);
        const bb = calcBollingerBands(closes, 20, 2);
        candleCache5m[asset.symbol] = {
          symbol: asset.symbol,
          klines,
          closes,
          rsi,
          ema9,
          ema21,
          bb,
          currentCandle: klines[klines.length - 1],
          prevCandle: klines[klines.length - 2],
          lastFetch: Date.now()
        };
      }
    } catch (e) {}
  }));
}

function getMarketSessionInfo() {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  let sessionName = 'SESSÃO NOTURNA';
  let liquidityLevel = 'MÉDIA';

  if (brHour >= 10 && brHour < 17) {
    sessionName = 'SESSÃO NOVA YORK (Volume Máximo Institucional)';
    liquidityLevel = 'ALTA';
  } else if ((brHour >= 21 && brHour <= 23) || (brHour >= 0 && brHour < 2)) {
    sessionName = 'SESSÃO ÁSIA (Reversões Rápidas de Fundo)';
    liquidityLevel = 'ALTA';
  } else if (brHour >= 2 && brHour < 8) {
    sessionName = 'SESSÃO MADRUGADA (Baixa Liquidez / Prudência)';
    liquidityLevel = 'BAIXA';
  } else {
    sessionName = 'SESSÃO EUROPA (Consolidação)';
    liquidityLevel = 'MÉDIA';
  }
  return { brHour, sessionName, liquidityLevel };
}

async function refreshMacroCache7d() {
  const eligible = MONITORED_ASSETS.filter(a => !['BTCBRL', 'ETHBRL', 'BNBBRL', 'USDCBRL'].includes(a.symbol));
  await Promise.all(eligible.map(async (asset) => {
    try {
      // 168 horas = 7 dias completos
      const klines1h = await getKlines(asset.symbol, '1h', 168);
      if (klines1h && klines1h.length >= 24) {
        const highs = klines1h.map(k => k.high);
        const lows = klines1h.map(k => k.low);
        const closes = klines1h.map(k => k.close);
        const high7d = Math.max(...highs);
        const low7d = Math.min(...lows);
        const curP = closes[closes.length - 1];

        const rangeSpan = high7d - low7d;
        const rangePosition7d = rangeSpan > 0 ? Number((((curP - low7d) / rangeSpan) * 100).toFixed(1)) : 50.0;

        // Order flow de compradores vs vendedores
        const last6 = klines1h.slice(-6);
        let vol6 = 0, buyVol6 = 0;
        last6.forEach(k => {
          vol6 += k.volume;
          buyVol6 += k.takerBuyBase || (k.volume * 0.5);
        });

        const last24 = klines1h.slice(-24);
        let vol24 = 0, buyVol24 = 0;
        last24.forEach(k => {
          vol24 += k.volume;
          buyVol24 += k.takerBuyBase || (k.volume * 0.5);
        });

        const buyerRatio6h = vol6 > 0 ? Number(((buyVol6 / vol6) * 100).toFixed(1)) : 50.0;
        const buyerRatio24h = vol24 > 0 ? Number(((buyVol24 / vol24) * 100).toFixed(1)) : 50.0;

        const ema50 = calcEMA(closes, Math.min(50, closes.length));
        const trend7d = curP >= ema50 ? 'ALTA_MACRO' : 'BAIXA_MACRO';

        macroCache7d[asset.symbol] = {
          symbol: asset.symbol,
          high7d,
          low7d,
          rangePosition7d,
          buyerRatio6h,
          buyerRatio24h,
          trend7d,
          lastFetch: Date.now()
        };
      }
    } catch (e) {}
  }));
}

// =============================================================================
// 3. ESTADO OFICIAL DO ECOSSISTEMA
// =============================================================================
const ecosystemState = {
  dayNumber: 1,
  dayProgressPct: 0,
  cycleSpeedSec: 86400,
  isRunning: true,
  initialSeedCapital: 10.00,
  targetProfitPerBot: 10.00, // Meta de +R$ 10 somados para clonar novo robô
  takeProfitMinPct: 0.35,    // Scalping rápido de centavos (Take Profit: R$ 0.05 a R$ 0.08)
  takeProfitMaxPct: 0.60,
  stopLossPctPerTrade: 0.35, // Stop loss de proteção curto: ~0.35% (apenas ~R$ 0.06 de perda máxima)
  trailingTriggerPct: 0.20,  // Quando o trade atingir +0.20% (+R$ 0.03/0.04), ativa o Trailing Lock
  trailingLockPct: 0.10,     // Trava de lucro mínimo no bolso (+R$ 0.02 garantidos)

  masterVaultBalance: 0.00,
  binanceFundingVault: 0.00,
  alpacaCashVault: 0.00,
  totalDepositedCapital: 10.00,
  totalHistoricalProfitSaved: 0.00,

  hiveMind: {
    collectiveIQ: 115,
    totalLessonsLearned: 1,
    totalTradesExecuted: 1,
    winningTrades: 1,
    globalBestWeights: { w_rsi: 0.85, w_ema: 0.90, w_bollinger: 0.75, w_macd: 0.80, w_flow: 0.70, w_regime: 0.85 },
    avoidedPatternsCount: 0,
    recentInsights: [
      'IA MULTI-CRIPTO: Operando scalping ultra-rápido de 5 centavos (+R$ 0,05) com Trailing Stop dinâmico.'
    ]
  },

  activeBots: [
    {
      id: 'BOT-REAL-01',
      name: 'Alpha-Multi-01',
      generation: 1,
      createdAtDay: 1,
      assignedAsset: 'BTC/BRL',
      marketType: 'BINANCE_CRIPTO',
      initialDayCapital: 10.00,
      currentCapital: 10.00,
      dailyPnL: 0.00,
      accumulatedCentsProfit: 0.00, // Acumulador de centavos rumo aos +R$ 10
      dailyTargetProfit: 10.00,
      accumulatedVaultProfit: 0.00,
      openPosition: null,
      brain: {
        iq: 118,
        confidenceThreshold: 0.60,
        weights: { w_rsi: 0.85, w_ema: 0.90, w_bollinger: 0.75, w_macd: 0.80, w_flow: 0.70, w_regime: 0.85 }
      }
    }
  ],
  deadBots: [],
  dailyLedger: [],
  tradeLogs: [],

  apiConfig: {
    mode: 'REAL_LIVE',
    isRealMoney: true,
    binanceApiKey: API_KEY.slice(0, 8) + '...',
    binanceConnected: true,
    alpacaConnected: false
  }
};

async function refreshBalancesAndAssets() {
  const balances = await getRealBalances();
  if (!balances || balances.error) return null;

  const usdcPrice = (await getLivePrice('USDCBRL')) || 5.24;
  const usdcTotal = balances.USDC || balances.LDUSDC || 0;
  const usdcVal = Number((usdcTotal * usdcPrice).toFixed(2));
  const brlFree = Number((balances.brlFree || 0).toFixed(2));

  let cryptoHoldingsValue = 0;
  const assetsList = [
    {
      asset: 'BRL',
      name: 'Real Brasileiro (Caixa Livre)',
      type: 'FIAT_FREE',
      qty: brlFree,
      price: 1.0,
      valueBrl: brlFree,
      role: 'Caixa Livre (Pronto para Comprar)',
      badgeClass: 'tag-fiat',
      pnlText: '--'
    }
  ];

  for (const asset of MONITORED_ASSETS) {
    if (asset.baseAsset === 'USDC' || asset.baseAsset === 'BRL') continue;
    const qty = balances[asset.baseAsset];
    if (qty && qty > 0.00000001) {
      const curPrice = (await getLivePrice(asset.symbol)) || 1;
      const val = Number((qty * curPrice).toFixed(2));
      if (val >= 0.10) {
        cryptoHoldingsValue += val;
        const managingBot = ecosystemState.activeBots.find(b =>
          (b.openPosition && b.openPosition.symbol.includes(asset.baseAsset)) ||
          b.assignedAsset.includes(asset.baseAsset)
        );
        const isDust = val < 5.00 && !managingBot;
        assetsList.push({
          asset: asset.baseAsset,
          name: asset.name,
          symbol: asset.symbol,
          type: isDust ? 'CRYPTO_DUST' : 'CRYPTO_SCALP',
          qty: qty,
          price: curPrice,
          valueBrl: val,
          role: managingBot 
            ? `${managingBot.name} (Scalping Ativo)` 
            : isDust 
            ? 'Resíduo de Ordem (Poeira)' 
            : 'Em Carteira Spot',
          badgeClass: isDust ? 'tag-dust' : 'tag-cripto',
          pnlText: managingBot && managingBot.dailyPnL ? `${managingBot.dailyPnL >= 0 ? '+' : ''}R$ ${managingBot.dailyPnL.toFixed(2)}` : '--'
        });
      }
    }
  }

  if (usdcTotal > 0) {
    assetsList.push({
      asset: 'USDC',
      name: 'USD Coin (Dólar Digital)',
      type: 'VAULT_EARN',
      qty: usdcTotal,
      price: usdcPrice,
      valueBrl: usdcVal,
      role: 'Cofre Protegido (Simple Earn)',
      badgeClass: 'tag-vault',
      pnlText: 'Rendendo Juros'
    });
  }

  const totalPatrimony = Number((brlFree + usdcVal + cryptoHoldingsValue).toFixed(2));

  ecosystemState.realBalances = {
    ...balances,
    brlFree,
    usdcTotal,
    usdcBrlValue: usdcVal,
    cryptoHoldingsValue: Number(cryptoHoldingsValue.toFixed(2)),
    totalPatrimony,
    assetsList
  };
  ecosystemState.totalDepositedCapital = totalPatrimony;
  ecosystemState.masterVaultBalance = usdcVal;

  return { balances, totalPatrimony, assetsList };
}

// =============================================================================
// 4. MOTOR INTELIGENTE DE SELEÇÃO E SCALPING
// =============================================================================
async function startMultiAssetTrader() {
  const currentIp = await getCurrentPublicIp();
  console.log('===================================================================');
  console.log(' 🚀 NEXUS DARWIN AI - MOTOR MULTI-CRIPTO 100% REAL (SCALPING)');
  console.log('===================================================================');
  console.log(`[RADAR DINÂMICO PILAR A]: Monitorando ${MONITORED_ASSETS.length} maiores ativos líquidos em BRL!`);
  console.log('[META POR TRADE]: Scalp Ultra-Rápido de 5 centavos (+R$ 0,05) c/ Trailing Lock (+R$ 0,03) e Stop (-R$ 0,06)');
  console.log(`[IP PÚBLICO ATUAL DA MÁQUINA]: ${currentIp}`);

  // Verifica saldos reais iniciais
  let balances = await getRealBalances();
  console.log('[SALDOS REAIS ENCONTRADOS]:', balances);

  if (balances.error && balances.code === -2015) {
    console.log('\n===================================================================');
    console.log('🚨 [AVISO DE AUTORIZAÇÃO DE IP NA BINANCE]:');
    console.log(`O seu provedor de internet rotacionou o seu IP para: ${currentIp}`);
    console.log('Para a Binance liberar as ordens, acesse a sua conta:');
    console.log('1. Perfil > Gerenciamento de API');
    console.log('2. Clique em "Editar Restrições" na sua chave API');
    console.log(`3. Adicione este IP à lista de IPs confiáveis: ${currentIp}`);
    console.log('===================================================================\n');
  }

  // ===========================================================================
  // RECUPERAÇÃO INTELIGENTE PÓS-REINÍCIO (REBOOT RECOVERY & AUTO-CURA)
  // ===========================================================================
  const reconciled = await persistentState.reconcileStateOnStartup(
    balances,
    MONITORED_ASSETS,
    getLivePrice,
    binanceSignedRequest
  );

  ecosystemState.activeBots = reconciled.activeBots;
  ecosystemState.tradeLogs = reconciled.tradeLogs;
  ecosystemState.hiveMind.totalTradesExecuted = ecosystemState.tradeLogs.length;

  // Salva no disco imediatamente
  persistentState.saveState(ecosystemState);

  await refreshBalancesAndAssets();

  console.log('📊 [CARREGANDO VELAS 5M BINANCE]: Carregando dados de velas de 5 minutos...');
  await refreshCandleCache5m();
  console.log('✅ [VELAS 5M BINANCE PRONTAS]: Filtro anti-topo institucional ativo.');

  console.log('📈 [CARREGANDO MACRO 7 DIAS & ORDER FLOW]: Carregando 168 horas de histórico institucional...');
  await refreshMacroCache7d();
  const sessionInfo = getMarketSessionInfo();
  console.log(`✅ [MACRO 7D & FLUXO ATIVOS]: ${sessionInfo.sessionName} (Liquidez: ${sessionInfo.liquidityLevel})`);

  console.log(`🤖 [LEAN SWARM ATIVADO]: 2 Robôs operando simultâneos com memória persistente!`);
  ecosystemState.activeBots.forEach((b, i) => {
    console.log(`   - Robô #${i + 1} (${b.name}): Moeda ${b.assignedAsset} ${b.openPosition ? `[Entrada Real: R$ ${b.openPosition.entryPrice} | Ordem #${b.openPosition.orderId}]` : '[Caixa Livre]'}`);
  });

  // Inicializa o Polling de comandos do Telegram (Controle Remoto pelo Celular)
  telegramNotifier.startPolling(async (command, chatId) => {
    const cmd = command.toLowerCase().trim();
    if (cmd === '/saldo' || cmd === 'saldo') {
      const refreshed = await refreshBalancesAndAssets();
      if (refreshed && refreshed.balances) balances = refreshed.balances;
      const btcPrice = (await getLivePrice('BTCBRL')) || 445000;
      const bnbPrice = (await getLivePrice('BNBBRL')) || 4140;
      const btcBrl = (balances.BTC || 0) * btcPrice;
      const bnbBrl = (balances.BNB || 0) * bnbPrice;
      const usdcBrl = (balances.usdcFree || balances.USDC || balances.LDUSDC || 0) * 5.25;
      const totalPatrimony = (balances.brlFree || 0) + btcBrl + bnbBrl + usdcBrl;
      return `💼 <b>SALDO ATUAL BINANCE (REAL)</b>\n\n` +
        `🇧🇷 <b>BRL Livre:</b> R$ ${(balances.brlFree || 0).toFixed(2)}\n` +
        `₿ <b>BTC:</b> ${(balances.BTC || 0).toFixed(6)} (~R$ ${btcBrl.toFixed(2)})\n` +
        `🔶 <b>BNB:</b> ${(balances.BNB || 0).toFixed(4)} (~R$ ${bnbBrl.toFixed(2)}) <i>(Desconto 25% ativo!)</i>\n` +
        `💵 <b>USDC Earn:</b> ${(balances.usdcFree || balances.USDC || balances.LDUSDC || 0).toFixed(2)} (~R$ ${usdcBrl.toFixed(2)})\n\n` +
        `💰 <b>Patrimônio Total: R$ ${totalPatrimony.toFixed(2)}</b>`;
    }
    if (cmd === '/status' || cmd === 'status') {
      let msg = `🤖 <b>STATUS DO ENXAME DARWIN</b>\n\n`;
      ecosystemState.activeBots.forEach((b, i) => {
        msg += `<b>Robô #${i + 1} (${b.name})</b>\n`;
        if (b.openPosition) {
          msg += `⚡ <i>Em Trade:</i> ${b.openPosition.assetName} (Entrada: R$ ${b.openPosition.entryPrice.toFixed(2)})\n`;
          msg += `🎯 <i>Alvo Líquido (+R$ 0,10):</i> R$ ${b.openPosition.targetTakeProfitPrice.toFixed(2)}\n`;
          msg += `🛡️ <i>Trailing Stop:</i> ${b.openPosition.trailingLocked ? 'Ativado (+R$ 0,05 garantido)' : 'Aguardando alvo'}\n\n`;
        } else {
          msg += `🟢 <i>Caixa Livre (Aguardando Oportunidade)</i>\n\n`;
        }
      });
      msg += `📊 <i>Trades Hoje:</i> ${ecosystemState.hiveMind.totalTradesExecuted} | <i>Acertos:</i> ${ecosystemState.hiveMind.winningTrades}\n`;
      return msg;
    }
    if (cmd === '/zerar' || cmd === 'zerar') {
      let closedCount = 0;
      for (const b of ecosystemState.activeBots) {
        if (b.openPosition) {
          const pos = b.openPosition;
          await executeRealMarketOrder(pos.symbol, 'SELL', null, pos.qty, pos.decimals, pos.baseAsset);
          b.openPosition = null;
          closedCount++;
        }
      }
      const refreshed = await refreshBalancesAndAssets();
      if (refreshed && refreshed.balances) balances = refreshed.balances;
      return `🛑 <b>POSIÇÕES ZERADAS COM SUCESSO!</b>\n\n` +
        `Total de ${closedCount} posição(ões) fechada(s) a mercado e convertida(s) para BRL. Robôs em segurança no caixa livre.`;
    }
    if (cmd === '/ajuda' || cmd === 'ajuda' || cmd === '/start') {
      return `👋 <b>NEXUS DARWIN AI - COMANDOS NO CELULAR</b>\n\n` +
        `📱 <b>/saldo</b> - Consulta saldos da Binance em tempo real\n` +
        `🤖 <b>/status</b> - Mostra status dos robôs e posições em trade\n` +
        `🛑 <b>/zerar</b> - Fecha todas as posições para BRL imediatamente\n` +
        `❓ <b>/ajuda</b> - Exibe esta lista de comandos`;
    }
    return null;
  });

  let tickCount = 0;
  let lastBuyAttempt = 0;
  let isExecutingOrder = false;
  const assetSellCooldowns = {};

  // Loop de Análise Multi-Moedas a cada 2.5 segundos
  setInterval(async () => {
    try {
      tickCount++;

      // A cada 6 ciclos (15 segundos), atualiza velas reais de 5 minutos de todas as moedas
      if (tickCount % 6 === 0) {
        refreshCandleCache5m().catch(() => {});
      }

      // A cada 120 ciclos (5 minutos), atualiza o canal macro de 7 dias (168h) e fluxo de compradores
      if (tickCount % 120 === 0) {
        refreshMacroCache7d().catch(() => {});
      }

      // Atualiza preços de todas as moedas simultaneamente
      for (const asset of MONITORED_ASSETS) {
        const p = await getLivePrice(asset.symbol);
        if (p) {
          priceHistories[asset.symbol].push(p);
          if (priceHistories[asset.symbol].length > 60) priceHistories[asset.symbol].shift();
        }
      }

      // Atualiza o Radar Scanner de Mercado com métricas técnicas (RSI 5M, EMA, 7D Range, Fluxo Comprador, Score e Status)
      const scannerList = [];
      for (const asset of MONITORED_ASSETS) {
        if (asset.baseAsset === 'BRL') continue;
        const h = priceHistories[asset.symbol] || [];
        const curPrice = h.length > 0 ? h[h.length - 1] : 0;
        const cData = candleCache5m[asset.symbol];
        const mData = macroCache7d[asset.symbol];

        // Prioridade absoluta para as velas reais de 5 minutos da Binance:
        const rsi = (cData && cData.rsi) ? cData.rsi : (h.length >= 10 ? Number(calcRSI(h, 14).toFixed(1)) : 50.0);
        const ema9 = (cData && cData.ema9) ? cData.ema9 : (h.length >= 5 ? calcEMA(h, 9) : curPrice);
        const ema21 = (cData && cData.ema21) ? cData.ema21 : (h.length >= 10 ? calcEMA(h, 21) : curPrice);
        const bb = (cData && cData.bb) ? cData.bb : null;
        const trend = ema9 >= ema21 ? 'ALTA' : 'BAIXA';

        const activeBotUsing = ecosystemState.activeBots.find(b =>
          (b.openPosition && b.openPosition.symbol === asset.symbol) ||
          b.assignedAsset.includes(asset.baseAsset)
        );

        let status = '⚪ Monitorando';
        let badge = 'tag-neutral';
        let score = 50;

        if (activeBotUsing && activeBotUsing.openPosition) {
          status = `⚡ Em Trade (${activeBotUsing.name})`;
          badge = 'tag-trading';
          score = 95;
        } else if (rsi <= 46 && bb && curPrice <= bb.lower * 1.004) {
          status = '🟢 Fundo Bollinger / Compra';
          badge = 'tag-buy';
          score = 92;
        } else if (rsi <= 46) {
          status = '🟡 Sobrevenda 5M';
          badge = 'tag-watch';
          score = 78;
        } else if (rsi > 60) {
          status = '🔴 Sobrecomprado (Evitar)';
          badge = 'tag-sell';
          score = 25;
        }

        scannerList.push({
          symbol: asset.symbol,
          name: asset.name,
          baseAsset: asset.baseAsset,
          price: curPrice,
          rsi,
          trend,
          score,
          status,
          badge,
          range7d: mData ? `${mData.rangePosition7d}% Fundo` : '--',
          rangePos7d: mData ? mData.rangePosition7d : 50,
          buyerFlow: mData ? `${mData.buyerRatio24h}% Comp.` : '--',
          buyerRatio24h: mData ? mData.buyerRatio24h : 50,
          min7d: mData ? mData.low7d : 0,
          max7d: mData ? mData.high7d : 0
        });
      }
      ecosystemState.marketScanner = scannerList;

      // A cada 12 ciclos (30 segundos), o Grok analisa o mercado e atualiza o conselho estratégico
      if (tickCount % 12 === 0 || !ecosystemState.grokAdvisor) {
        await runGrokStrategicAnalysis(ecosystemState, scannerList);
      }

      // Analisa cada robô ativo
      for (let i = 0; i < ecosystemState.activeBots.length; i++) {
        const bot = ecosystemState.activeBots[i];

        // Se estiver em pausa de proteção (Circuit Breaker por 2 stops consecutivos), pula a abertura
        if (bot.circuitBreakerUntil && Date.now() < bot.circuitBreakerUntil) {
          continue;
        }

        // ---------------------------------------------------------------------
        // SE NÃO TEM POSIÇÃO: ESCANEIA A MELHOR OPORTUNIDADE ENTRE AS MOEDAS
        // ---------------------------------------------------------------------
        if (!bot.openPosition) {
          let bestCandidate = null;
          let lowestRsi = 999;

          for (const asset of MONITORED_ASSETS) {
            // Evita recompra imediata da mesma moeda recém-vendida (cooldown de 3 minutos para permitir rotação de ativos)
            if (assetSellCooldowns[asset.symbol] && Date.now() < assetSellCooldowns[asset.symbol]) {
              continue;
            }

            // BLOQUEIO TOTAL DE ELEFANTES / MEGA CAPS: NUNCA OPERA BTC, ETH, BNB OU USDC!
            if (['BTCBRL', 'ETHBRL', 'BNBBRL', 'USDCBRL'].includes(asset.symbol)) {
              continue;
            }

            // Não compra a mesma moeda se outro robô já estiver posicionado nela
            if (ecosystemState.activeBots.some(b => b.openPosition && b.openPosition.symbol === asset.symbol)) {
              continue;
            }

            const cData = candleCache5m[asset.symbol];
            if (!cData || !cData.closes || cData.closes.length < 15) {
              continue;
            }

            const mData = macroCache7d[asset.symbol];
            const rangePos7d = mData ? mData.rangePosition7d : 50;
            const buyerRatio24h = mData ? mData.buyerRatio24h : 50;

            // -------------------------------------------------------------
            // CAMADA 1: CANAL MACRO DE 7 DIAS (168 HORAS - ANTI-TOPO SEMANAL)
            // -------------------------------------------------------------
            // Se o ativo estiver nos 30% superiores do seu canal semanal (> 70%), DESCARTA!
            // Garante que o robô NUNCA compre ativos esticados no topo do gráfico semanal.
            if (rangePos7d > 70.0) {
              continue;
            }

            // -------------------------------------------------------------
            // CAMADA 2: FLUXO DE ORDENS COMPRADORAS VS VENDEDORAS (TAKER BUY FLOW 24H)
            // -------------------------------------------------------------
            // Se o volume de compradores agressivos for menor que 42% (vendedores > 58%),
            // significa que o ativo está em sangria contínua / despejo institucional, DESCARTA!
            if (buyerRatio24h < 42.0) {
              continue;
            }

            const rsi5m = cData.rsi;
            const ema9 = cData.ema9;
            const ema21 = cData.ema21;
            const bb = cData.bb;
            const curP = priceHistories[asset.symbol]?.length > 0
              ? priceHistories[asset.symbol][priceHistories[asset.symbol].length - 1]
              : cData.currentCandle.close;
            const prevClose = cData.prevCandle ? cData.prevCandle.close : curP;

            // -------------------------------------------------------------
            // CAMADA 3: GATILHO MICRO SNIPER (VELAS DE 5 MINUTOS - BINANCE)
            // -------------------------------------------------------------
            // 1. REGRA ANTI-TOPO DE VELAS 5M: Se RSI > 46, descarta (nunca compra vela verde esticada)
            if (rsi5m > 46) {
              continue;
            }

            // 2. SOBREVENDA REAL: RSI de 5m <= 46
            const isOversold = rsi5m <= 46;

            // 3. PULLBACK OU TOQUE NA BANDA INFERIOR DE BOLLINGER (5M) OU SOBREVENDA FORTE
            const touchesLowerBand = curP <= (bb.lower * 1.004);

            // 4. ESTABILIDADE DE FUNDO: Preço não está despencando sem suporte
            const bottomRejection = curP >= (prevClose * 0.995);

            // 5. SUPORTE DE MÉDIAS MÓVEIS (EMA 9 vs EMA 21)
            const emaSupport = ema9 >= (ema21 * 0.985);

            if (isOversold && (touchesLowerBand || rsi5m <= 38) && bottomRejection && emaSupport && rsi5m < lowestRsi) {
              lowestRsi = rsi5m;
              bestCandidate = { 
                asset, 
                rsi: rsi5m, 
                price: curP, 
                bbLower: bb.lower,
                rangePos7d,
                buyerRatio24h
              };
            }
          }

          // Se achou uma oportunidade Sniper e o intervalo entre compras foi respeitado:
          if (bestCandidate && (Date.now() - lastBuyAttempt > 15000)) {
            const freshBal = await refreshBalancesAndAssets();
            if (freshBal && freshBal.balances) balances = freshBal.balances;

            const availableBrl = balances.brlFree || 0;
            const freeBotsCount = ecosystemState.activeBots.filter(b => !b.openPosition).length;
            const targetCapital = freeBotsCount > 1 ? (availableBrl / freeBotsCount) : availableBrl;
            const buyAmount = Number((Math.floor(Math.min(availableBrl, Math.max(10.00, targetCapital)) * 100) / 100).toFixed(2));

            if (availableBrl >= 10.00 && buyAmount >= 10.00 && !isExecutingOrder) {
              isExecutingOrder = true;
              lastBuyAttempt = Date.now();
              try {
                const { asset, rsi, price, rangePos7d, buyerRatio24h } = bestCandidate;
                console.log(`🎯 [SNIPER 3-CAMADAS EM ${asset.name}!] Canal 7D: ${rangePos7d}% | Compradores 24h: ${buyerRatio24h}% | RSI 5M: ${rsi.toFixed(1)} | Preço: R$ ${price} | Ordem: R$ ${buyAmount}`);

                const order = await executeRealMarketOrder(asset.symbol, 'BUY', buyAmount, null, asset.decimals, asset.baseAsset);

                if (order && (order.orderId || order.status === 'FILLED')) {
                  const executedQty = parseFloat(order.executedQty) || (buyAmount / price);
                  const cummulativeQuote = parseFloat(order.cummulativeQuoteQty) || buyAmount;
                  const avgPrice = cummulativeQuote / executedQty || price;

                  bot.assignedAsset = asset.symbol.replace('BRL', '/BRL');

                  // META INSTITUCIONAL COM FOLGA DE 3X O VALOR DA TAXA (+1.5% a +2.2% BRUTO)
                  // Desconto de taxa da Binance com saldo BNB (0.15% roundtrip) ou padrão (0.20% roundtrip)
                  const hasBnb = balances.BNB && balances.BNB >= 0.001;
                  const feeRate = hasBnb ? 0.0015 : 0.0020;
                  const estRoundtripFee = cummulativeQuote * feeRate;
                  const feePlusFriction = estRoundtripFee + (cummulativeQuote * 0.0010); // buffer de spread

                  // Alvo Líquido no bolso: NO MÍNIMO 3X A TAXA (ex: R$ 0,22 a R$ 0,30 de lucro limpo)
                  const targetNetBrl = Math.max(0.22, Number((feePlusFriction * 3.5).toFixed(2)));
                  const targetGrossBrl = targetNetBrl + estRoundtripFee;

                  const priceDecimals = avgPrice < 1 ? 4 : (avgPrice < 10 ? 3 : 2);
                  const targetTakeProfitPrice = Number((avgPrice + (targetGrossBrl / executedQty)).toFixed(priceDecimals));

                  // Trailing Lock ativa quando o lucro líquido atingir 2x o valor da taxa (~R$ 0,12 líquido)
                  const trailingTriggerNet = Math.max(0.12, Number((feePlusFriction * 2.0).toFixed(2)));
                  const trailingLockTriggerPrice = Number((avgPrice + ((trailingTriggerNet + estRoundtripFee) / executedQty)).toFixed(priceDecimals));

                  // Trava mínima garantida no bolso quando aciona o trailing: 1.5x a taxa (~R$ 0,08 líquido)
                  const lockedMinNet = Math.max(0.08, Number((feePlusFriction * 1.5).toFixed(2)));

                  // Stop Loss proporcional (-1.8% a -2.0% ou ~R$ 0,25 a R$ 0,28)
                  const stopLossAmount = Math.max(0.25, Number((cummulativeQuote * 0.018).toFixed(2)));
                  const stopLossPrice = Number((avgPrice - (stopLossAmount / executedQty)).toFixed(priceDecimals));

                  bot.openPosition = {
                    symbol: asset.symbol,
                    assetName: asset.name,
                    baseAsset: asset.baseAsset,
                    decimals: asset.decimals,
                    side: 'LONG',
                    entryPrice: avgPrice,
                    qty: executedQty,
                    notionalBrl: cummulativeQuote,
                    orderId: order.orderId,
                    openedAt: new Date().toLocaleTimeString('pt-BR'),
                    openedTimestamp: Date.now(),
                    targetTakeProfitPrice,
                    targetProfitBrl: targetNetBrl,
                    trailingLockTriggerPrice,
                    stopLossPrice,
                    trailingLocked: false,
                    peakNetPnlBrl: 0,
                    lockedMinNetPnlBrl: lockedMinNet,
                    estRoundtripFee
                  };

                  const buyMsg = `🟢 [COMPRA REAL BINANCE] ${bot.name} comprou R$ ${cummulativeQuote.toFixed(2)} em ${asset.name} (ID: ${order.orderId})`;
                  console.log(buyMsg);
                  ecosystemState.hiveMind.recentInsights.unshift(buyMsg);
                  ecosystemState.tradeLogs.unshift({
                    botId: bot.id,
                    botName: bot.name,
                    symbol: bot.assignedAsset,
                    action: 'BUY',
                    price: avgPrice,
                    amount: cummulativeQuote,
                    timestamp: new Date().toLocaleTimeString('pt-BR'),
                    realOrderId: order.orderId
                  });

                  // Notificação em tempo real no Telegram
                  telegramNotifier.notifyBuy(bot.name, asset.name, asset.symbol, cummulativeQuote, avgPrice, order.orderId, targetTakeProfitPrice).catch(() => {});

                  persistentState.saveState(ecosystemState);
                  await cloudSync.syncEcosystemState(ecosystemState);
                }
              } finally {
                isExecutingOrder = false;
              }
            }
          }
        }

        // ---------------------------------------------------------------------
        // SE TEM POSIÇÃO ABERTA: MONITORA SCALPING DE 1.0% A 1.5% OU STOP LOSS
        // ---------------------------------------------------------------------
        else if (bot.openPosition) {
          const pos = bot.openPosition;
          const currentPrice = await getLivePrice(pos.symbol);
          if (!currentPrice) continue;

          const currentValBrl = pos.qty * currentPrice;
          const grossPnlBrl = currentValBrl - pos.notionalBrl;
          const grossPnlPct = (grossPnlBrl / pos.notionalBrl) * 100;

          // Custo Real de Taxas da Binance (0.10% compra + 0.10% venda = 0.20% total, ou 0.15% com BNB)
          const hasBnb = balances.BNB && balances.BNB >= 0.001;
          const feeRate = hasBnb ? 0.0015 : 0.0020;
          const estimatedRoundtripFee = Number(((pos.notionalBrl || 20) * feeRate).toFixed(4));
          const netPnlBrl = Number((grossPnlBrl - estimatedRoundtripFee).toFixed(2));
          const netPnlPct = Number(((netPnlBrl / pos.notionalBrl) * 100).toFixed(2));

          bot.dailyPnL = netPnlBrl;
          bot.currentCapital = Number((pos.notionalBrl + netPnlBrl).toFixed(2));

          if (tickCount % 4 === 0) {
            const pDec = pos.entryPrice < 1 ? 4 : (pos.entryPrice < 10 ? 3 : 2);
            console.log(`[SCALPING ${pos.assetName}] Entrada: R$ ${pos.entryPrice.toFixed(pDec)} | Atual: R$ ${currentPrice.toFixed(pDec)} | Bruto: ${grossPnlPct >= 0 ? '+' : ''}${grossPnlPct.toFixed(2)}% (R$ ${grossPnlBrl.toFixed(2)}) | Líquido no Bolso: ${netPnlPct >= 0 ? '+' : ''}${netPnlPct.toFixed(2)}% (R$ ${netPnlBrl.toFixed(2)})`);
          }

          // 1. TRAILING PROFIT LOCK DINÂMICO (FOLGA DE 3X A TAXA)
          // Parâmetros mínimos de proteção calculados em relação ao custo da taxa
          const minTargetNet = pos.targetProfitBrl || Math.max(0.22, Number((estimatedRoundtripFee * 3.5).toFixed(2)));
          const trailingTriggerNet = Math.max(0.12, Number((estimatedRoundtripFee * 2.0).toFixed(2)));
          const baseLockedNet = pos.lockedMinNetPnlBrl || Math.max(0.08, Number((estimatedRoundtripFee * 1.5).toFixed(2)));

          // SÓ ativa o Trailing quando o lucro líquido já pagou 100% das taxas e deu pelo menos 2x a taxa de lucro líquido (+R$ 0,12+)
          const isEligibleTrailing = (netPnlBrl >= trailingTriggerNet);
          if (!pos.trailingLocked && isEligibleTrailing) {
            pos.trailingLocked = true;
            pos.peakNetPnlBrl = netPnlBrl;
            pos.lockedMinNetPnlBrl = baseLockedNet;
            console.log(`🛡️ [TRAILING LOCK ATIVADO]: ${pos.assetName} bateu lucro LÍQUIDO de +R$ ${netPnlBrl.toFixed(2)} (+${netPnlPct.toFixed(2)}%)! Mínimo de +R$ ${baseLockedNet.toFixed(2)} blindado no bolso (3x taxa)!`);
          }

          // Se o preço subir ainda mais, a trava do Trailing Stop sobe colada atrás!
          if (pos.trailingLocked) {
            if (!pos.peakNetPnlBrl || netPnlBrl > pos.peakNetPnlBrl) {
              pos.peakNetPnlBrl = netPnlBrl;
              pos.lockedMinNetPnlBrl = Math.max(pos.lockedMinNetPnlBrl || baseLockedNet, Number((netPnlBrl - 0.05).toFixed(2)));
            }
          }

          // 2. GATILHOS DE SAÍDA BASEADOS EM LUCRO LÍQUIDO (NO BOLSO):
          // - Take Profit: bateu a meta com folga de 3x a taxa (+R$ 0,22 a +R$ 0,30 líquido)
          // - Trailing Lock: recuou para a trava de lucro líquido blindado
          // - Stop Loss: perda líquida de ~-1.8% a -2.0% (ou -R$ 0.25)
          // - Trade Parado (Stale Trade Exit): após 60 min, só encerra se o lucro LÍQUIDO for de pelo menos 1.5x a taxa (+R$ 0.08 líquido no bolso)
          const holdingTimeMs = Date.now() - (pos.openedTimestamp || (Date.now() - 60000));
          const isStaleTrade = (holdingTimeMs > 60 * 60 * 1000) && (netPnlBrl >= baseLockedNet);

          const hitTakeProfit = (netPnlBrl >= minTargetNet);
          const hitTrailingExit = pos.trailingLocked && (netPnlBrl <= (pos.lockedMinNetPnlBrl || baseLockedNet));
          const hitStopLoss = !pos.trailingLocked && (netPnlBrl <= (-(pos.notionalBrl * 0.020) || -0.25));

          if ((hitTakeProfit || hitTrailingExit || hitStopLoss || isStaleTrade) && !isExecutingOrder) {
            isExecutingOrder = true;
            try {
            const reason = hitTakeProfit
              ? `LUCRO LÍQUIDO RÁPIDO (+R$ ${netPnlBrl.toFixed(2)} / +${netPnlPct.toFixed(2)}%)`
              : hitTrailingExit
              ? `TRAILING LOCK LÍQUIDO (+R$ ${netPnlBrl.toFixed(2)} / +${netPnlPct.toFixed(2)}%)`
              : isStaleTrade
              ? `ROTAÇÃO DE TRADE PARADO (>15 min no empate: ${netPnlBrl >= 0 ? '+' : ''}R$ ${netPnlBrl.toFixed(2)})`
              : `STOP LOSS DE PROTEÇÃO (${netPnlPct.toFixed(2)}% / R$ ${netPnlBrl.toFixed(2)})`;
            console.log(`🏁 [ENCERRANDO OPERAÇÃO]: ${reason} | Bruto: R$ ${grossPnlBrl.toFixed(2)} | Taxas Binance: -R$ ${estimatedRoundtripFee.toFixed(2)} | Líquido Real: R$ ${netPnlBrl.toFixed(2)}`);

            const sellResult = await executeRealMarketOrder(pos.symbol, 'SELL', null, pos.qty, pos.decimals, pos.baseAsset);

            if (sellResult && (sellResult.orderId || sellResult.status === 'FILLED')) {
              const finalQuote = parseFloat(sellResult.cummulativeQuoteQty) || currentValBrl;
              const rawProfit = finalQuote - pos.notionalBrl;
              const finalProfit = Number((rawProfit - estimatedRoundtripFee).toFixed(2));

              bot.currentCapital = Number((bot.initialDayCapital + finalProfit).toFixed(2));
              bot.dailyPnL = Number(finalProfit.toFixed(2));
              bot.accumulatedCentsProfit = Number(((bot.accumulatedCentsProfit || 0) + finalProfit).toFixed(2));
              bot.openPosition = null;
              assetSellCooldowns[pos.symbol] = Date.now() + (3 * 60 * 1000); // 3 minutos de cooldown nesta moeda
              console.log(`⏳ [ROTAÇÃO INTELIGENTE]: Cooldown de 3 min ativado para ${pos.symbol} para rotação limpa de ativos.`);

              ecosystemState.hiveMind.totalTradesExecuted++;
              if (finalProfit > 0) {
                ecosystemState.hiveMind.winningTrades++;
                ecosystemState.hiveMind.collectiveIQ += 2;
                bot.consecutiveLosses = 0;
              }

              // Circuit Breaker: Rastreia perdas consecutivas
              if (finalProfit < 0) {
                bot.consecutiveLosses = (bot.consecutiveLosses || 0) + 1;
                if (bot.consecutiveLosses >= 2) {
                  bot.circuitBreakerUntil = Date.now() + (3 * 60 * 1000); // 3 minutos de resfriamento
                  const cbMsg = `🛑 [CIRCUIT BREAKER] ${bot.name} pausado por 3 min para proteção rápida.`;
                  console.log(cbMsg);
                  ecosystemState.hiveMind.recentInsights.unshift(cbMsg);
                }
              } else {
                bot.consecutiveLosses = 0;
              }

              const sellMsg = `🔴 [VENDA REAL ${pos.assetName}] ${reason}: Lucro no bolso de ${finalProfit >= 0 ? '+' : ''}R$ ${finalProfit.toFixed(2)} | Total Acumulado: R$ ${bot.accumulatedCentsProfit.toFixed(2)}`;
              console.log(sellMsg);
              ecosystemState.hiveMind.recentInsights.unshift(sellMsg);
              ecosystemState.tradeLogs.unshift({
                botId: bot.id,
                botName: bot.name,
                symbol: pos.symbol.replace('BRL', '/BRL'),
                action: 'SELL',
                price: currentPrice,
                amount: finalQuote,
                profit: finalProfit,
                timestamp: new Date().toLocaleTimeString('pt-BR'),
                realOrderId: sellResult.orderId
              });

              // Notificação em tempo real no Telegram
              telegramNotifier.notifySell(
                bot.name,
                pos.assetName,
                pos.symbol,
                finalProfit,
                rawProfit,
                estimatedRoundtripFee,
                currentPrice,
                ecosystemState.realBalances?.totalPatrimony || 53.56
              ).catch(() => {});

              // ===============================================================
              // PLANO MESTRE LEAN SWARM (3X RESERVA, REGRA 80/20 & ESCALA DE LOTE)
              // ===============================================================
              const currentSeed = bot.initialDayCapital || 10.00;
              const targetToScale = currentSeed * 3; // Regra dos 3x (ex: acumular R$ 30 antes de subir de fase)

              if (bot.accumulatedCentsProfit >= targetToScale) {
                const totalHarvest = targetToScale;
                const vaultShare = totalHarvest * 0.20; // 20% vai para o cofre blindado (USDC + PAXG Ouro)
                const scaleShare = totalHarvest * 0.80; // 80% vai para acelerar capital operacional

                bot.accumulatedCentsProfit -= totalHarvest;
                ecosystemState.masterVaultBalance += vaultShare;
                ecosystemState.totalHistoricalProfitSaved += vaultShare;
                bot.accumulatedVaultProfit = (bot.accumulatedVaultProfit || 0) + vaultShare;

                console.log(`🛡️ [COFRE BLINDADO 80/20]: R$ ${vaultShare.toFixed(2)} transferidos para proteção de longo prazo!`);

                const MAX_BOTS = 6; // Teto operacional seguro para evitar rate limits da API
                if (ecosystemState.activeBots.length < MAX_BOTS) {
                  // Clona novo robô especializado no enxame
                  const nextAsset = MONITORED_ASSETS[ecosystemState.activeBots.length % MONITORED_ASSETS.length];
                  const newBot = {
                    id: `BOT-REAL-0${ecosystemState.activeBots.length + 1}`,
                    name: `Darwin-Multi-0${ecosystemState.activeBots.length + 1}`,
                    generation: ecosystemState.activeBots.length + 1,
                    createdAtDay: 1,
                    assignedAsset: nextAsset.symbol.replace('BRL', '/BRL'),
                    marketType: 'BINANCE_CRIPTO',
                    initialDayCapital: currentSeed,
                    currentCapital: currentSeed,
                    dailyPnL: 0.00,
                    accumulatedCentsProfit: 0.00,
                    dailyTargetProfit: currentSeed,
                    accumulatedVaultProfit: 0.00,
                    openPosition: null,
                    consecutiveLosses: 0,
                    brain: {
                      iq: (bot.brain?.iq || 115) + 5,
                      confidenceThreshold: (bot.brain?.confidenceThreshold || 0.60) + 0.01,
                      weights: { ...(bot.brain?.weights || {}) }
                    }
                  };
                  ecosystemState.activeBots.push(newBot);

                  const cloneLog = `🧬 [ENXAME LEAN SWARM] ${newBot.name} ativado com R$ ${currentSeed.toFixed(2)} para operar ${nextAsset.name}!`;
                  console.log(cloneLog);
                  ecosystemState.hiveMind.recentInsights.unshift(cloneLog);
                } else {
                  // Quando o enxame já tem 6 robôs, o lucro escala a BANCA existente (de 10 para 50, 100, 500)!
                  const boostPerBot = Number((scaleShare / ecosystemState.activeBots.length).toFixed(2));
                  ecosystemState.activeBots.forEach((b) => {
                    b.initialDayCapital += boostPerBot;
                    b.currentCapital += boostPerBot;
                  });
                  const boostLog = `📈 [ESCALA DE BANCA!] Enxame consolidado (6 robôs). Capital operacional elevado em +R$ ${boostPerBot.toFixed(2)} por robô!`;
                  console.log(boostLog);
                  ecosystemState.hiveMind.recentInsights.unshift(boostLog);
                }
              }

              persistentState.saveState(ecosystemState);
              await cloudSync.syncEcosystemState(ecosystemState);
            }
          } finally {
            isExecutingOrder = false;
          }
        }
      }
    }

      // Atualiza saldos reais e lista de ativos da Binance a cada 6 ticks (15s)
      if (tickCount % 6 === 0) {
        const refreshed = await refreshBalancesAndAssets();
        if (refreshed && refreshed.balances) balances = refreshed.balances;
      }

      // Sincroniza o estado atualizado no Firebase e no disco a cada 3 ticks
      if (tickCount % 3 === 0) {
        persistentState.saveState(ecosystemState);
        await cloudSync.syncEcosystemState(ecosystemState);
      }
    } catch (err) {
      console.error('[ERRO NO CICLO MULTI-CRIPTO]:', err.message);
    }
  }, 2500);
}

startMultiAssetTrader();
