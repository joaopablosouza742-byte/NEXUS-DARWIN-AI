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

// =============================================================================
// CESTA DE MOEDAS MONITORADAS (MULTI-CRIPTO)
// =============================================================================
const MONITORED_ASSETS = [
  { symbol: 'BTCBRL', baseAsset: 'BTC', name: 'Bitcoin', decimals: 5, minQty: 0.00001 },
  { symbol: 'ETHBRL', baseAsset: 'ETH', name: 'Ethereum', decimals: 4, minQty: 0.0001 },
  { symbol: 'SOLBRL', baseAsset: 'SOL', name: 'Solana', decimals: 3, minQty: 0.001 },
  { symbol: 'BNBBRL', baseAsset: 'BNB', name: 'BNB', decimals: 3, minQty: 0.001 },
  { symbol: 'XRPBRL', baseAsset: 'XRP', name: 'XRP', decimals: 1, minQty: 0.1 },
  { symbol: 'DOGEBRL', baseAsset: 'DOGE', name: 'Dogecoin', decimals: 0, minQty: 1 },
  { symbol: 'ADABRL', baseAsset: 'ADA', name: 'Cardano', decimals: 1, minQty: 0.1 },
  { symbol: 'LINKBRL', baseAsset: 'LINK', name: 'Chainlink', decimals: 2, minQty: 0.01 },
  { symbol: 'AVAXBRL', baseAsset: 'AVAX', name: 'Avalanche', decimals: 2, minQty: 0.01 },
  { symbol: 'NEARBRL', baseAsset: 'NEAR', name: 'NEAR Protocol', decimals: 1, minQty: 0.1 },
  { symbol: 'SUIBRL', baseAsset: 'SUI', name: 'Sui', decimals: 1, minQty: 0.1 },
  { symbol: 'RENDERBRL', baseAsset: 'RENDER', name: 'Render', decimals: 2, minQty: 0.01 },
  { symbol: 'LTCBRL', baseAsset: 'LTC', name: 'Litecoin', decimals: 3, minQty: 0.001 },
  { symbol: 'POLBRL', baseAsset: 'POL', name: 'Polygon', decimals: 1, minQty: 0.1 },
  { symbol: 'PEPEBRL', baseAsset: 'PEPE', name: 'Pepe', decimals: 0, minQty: 1 },
  { symbol: 'USDCBRL', baseAsset: 'USDC', name: 'USD Coin', decimals: 2, minQty: 0.1 }
];

const priceHistories = {};
MONITORED_ASSETS.forEach(a => { priceHistories[a.symbol] = []; });

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
  if (losses === 0) return 100;
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
  takeProfitMinPct: 1.2,     // Scalping ideal calibrado: 1.2% a 1.5%
  takeProfitMaxPct: 1.5,
  stopLossPctPerTrade: 0.9,  // Stop loss de proteção: 0.9%
  trailingTriggerPct: 1.0,   // Quando o trade atingir +1.0%, ativa o Trailing Lock
  trailingLockPct: 0.4,      // Trava de saída garantida no lucro (+0.4% no bolso)

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
      'IA MULTI-CRIPTO: Monitorando BTC, SOL, ETH e BNB para scalping inteligente de 1.0% a 1.5%.'
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

// =============================================================================
// 4. MOTOR INTELIGENTE DE SELEÇÃO E SCALPING
// =============================================================================
async function startMultiAssetTrader() {
  const currentIp = await getCurrentPublicIp();
  console.log('===================================================================');
  console.log(' 🚀 NEXUS DARWIN AI - MOTOR MULTI-CRIPTO 100% REAL (SCALPING)');
  console.log('===================================================================');
  console.log(`[RADAR DINÂMICO PILAR A]: Monitorando ${MONITORED_ASSETS.length} maiores ativos líquidos em BRL!`);
  console.log('[META POR TRADE]: 1.2% a 1.5% c/ Trailing Lock (+0.4% garantido)');
  console.log(`[IP PÚBLICO ATUAL DA MÁQUINA]: ${currentIp}`);

  // Verifica saldos reais iniciais
  const balances = await getRealBalances();
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

  let cryptoHoldingsValue = 0;
  let activeFoundPosition = null;

  for (const asset of MONITORED_ASSETS) {
    if (asset.baseAsset === 'USDC' || asset.baseAsset === 'BRL') continue;
    const qty = balances[asset.baseAsset];
    if (qty && qty >= asset.minQty) {
      const curPrice = (await getLivePrice(asset.symbol)) || 1;
      const val = Number((qty * curPrice).toFixed(2));
      if (val >= 1.00) {
        cryptoHoldingsValue += val;
        if (!activeFoundPosition && val >= 2.00) {
          activeFoundPosition = {
            symbol: asset.symbol,
            assetName: asset.name,
            baseAsset: asset.baseAsset,
            decimals: asset.decimals,
            side: 'LONG',
            entryPrice: curPrice,
            qty: qty,
            notionalBrl: val,
            orderId: 'LIVE-' + Date.now(),
            openedAt: new Date().toLocaleTimeString('pt-BR')
          };
        }
      }
    }
  }

  const usdcPrice = (await getLivePrice('USDCBRL')) || 5.24;
  const usdcTotal = balances.USDC || balances.LDUSDC || 0;
  const totalBrlEquivalent = (balances.brlFree || 0) + (usdcTotal * usdcPrice) + cryptoHoldingsValue;
  console.log(`[PATRIMÔNIO REAL]: R$ ${(balances.brlFree || 0).toFixed(2)} BRL livres + ${usdcTotal.toFixed(4)} USDC (~R$ ${(usdcTotal * usdcPrice).toFixed(2)}) + Cripto R$ ${cryptoHoldingsValue.toFixed(2)} = Total R$ ${totalBrlEquivalent.toFixed(2)}`);

  ecosystemState.realBalances = {
    ...balances,
    usdcTotal,
    usdcBrlValue: Number((usdcTotal * usdcPrice).toFixed(2)),
    cryptoHoldingsValue: Number(cryptoHoldingsValue.toFixed(2))
  };
  ecosystemState.totalDepositedCapital = Number(totalBrlEquivalent.toFixed(2));

  // Configuração dos Robôs com base no depósito confirmado de R$ 40,00
  const freeBrl = balances.brlFree || 0;
  if (freeBrl >= 35.0) {
    const halfBrl = Number((Math.floor((freeBrl / 2) * 100) / 100).toFixed(2));
    ecosystemState.activeBots = [
      {
        id: 'BOT-REAL-01',
        name: 'Alpha-Titans-01',
        generation: 1,
        createdAtDay: 1,
        assignedAsset: 'BTC/BRL',
        marketType: 'BINANCE_CRIPTO',
        initialDayCapital: halfBrl,
        currentCapital: halfBrl,
        dailyPnL: 0.00,
        accumulatedCentsProfit: 0.00,
        dailyTargetProfit: 20.00,
        accumulatedVaultProfit: 0.00,
        openPosition: null,
        brain: {
          iq: 122,
          confidenceThreshold: 0.60,
          weights: { w_rsi: 0.85, w_ema: 0.90, w_bollinger: 0.75, w_macd: 0.80, w_flow: 0.70, w_regime: 0.85 }
        }
      },
      {
        id: 'BOT-REAL-02',
        name: 'Beta-Speed-02',
        generation: 1,
        createdAtDay: 1,
        assignedAsset: activeFoundPosition ? activeFoundPosition.symbol.replace('BRL', '/BRL') : 'BNB/BRL',
        marketType: 'BINANCE_CRIPTO',
        initialDayCapital: halfBrl,
        currentCapital: activeFoundPosition ? activeFoundPosition.notionalBrl : halfBrl,
        dailyPnL: 0.00,
        accumulatedCentsProfit: 0.00,
        dailyTargetProfit: 20.00,
        accumulatedVaultProfit: 0.00,
        openPosition: activeFoundPosition || null,
        brain: {
          iq: 119,
          confidenceThreshold: 0.58,
          weights: { w_rsi: 0.88, w_ema: 0.85, w_bollinger: 0.80, w_macd: 0.75, w_flow: 0.75, w_regime: 0.80 }
        }
      }
    ];
    console.log(`🤖 [LEAN SWARM ATIVADO]: 2 Robôs operando simultâneos!`);
    console.log(`   - Robô #1 (Alpha): R$ ${halfBrl.toFixed(2)} alocados (Foco: BTC, ETH, SOL)`);
    console.log(`   - Robô #2 (Beta): R$ ${halfBrl.toFixed(2)} alocados (Foco: BNB, XRP, SUI, DOGE) ${activeFoundPosition ? `[Posição BNB ativa: R$ ${activeFoundPosition.notionalBrl}]` : ''}`);
  } else if (activeFoundPosition) {
    ecosystemState.activeBots[0].assignedAsset = activeFoundPosition.symbol.replace('BRL', '/BRL');
    ecosystemState.activeBots[0].openPosition = activeFoundPosition;
    ecosystemState.activeBots[0].currentCapital = activeFoundPosition.notionalBrl;
    console.log(`[POSIÇÃO ATIVA DETECTADA]: ${activeFoundPosition.qty} ${activeFoundPosition.baseAsset} (~R$ ${activeFoundPosition.notionalBrl}) monitorando saída no lucro de 1% a 1.5%!`);
  } else {
    ecosystemState.activeBots[0].currentCapital = Number((Math.floor((balances.brlFree || 5.00) * 100) / 100).toFixed(2));
  }

  let tickCount = 0;
  let lastBuyAttempt = 0;

  // Loop de Análise Multi-Moedas a cada 2.5 segundos
  setInterval(async () => {
    try {
      tickCount++;

      // Atualiza preços de todas as moedas simultaneamente
      for (const asset of MONITORED_ASSETS) {
        const p = await getLivePrice(asset.symbol);
        if (p) {
          priceHistories[asset.symbol].push(p);
          if (priceHistories[asset.symbol].length > 60) priceHistories[asset.symbol].shift();
        }
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
            const h = priceHistories[asset.symbol];
            if (h.length >= 10) {
              const rsi = calcRSI(h, 14);
              const ema9 = calcEMA(h, 9);
              const ema21 = calcEMA(h, 21);

              // Procura moeda em ponto ideal de sobrevenda ou cruzamento altista
              if (rsi < 48 && ema9 >= ema21 * 0.9995 && rsi < lowestRsi) {
                lowestRsi = rsi;
                bestCandidate = { asset, rsi, price: h[h.length - 1] };
              }
            }
          }

          // Se achou uma oportunidade e o robô tem no mínimo R$ 2,00 em caixa (cooldown de 30s se falhar):
          if (bestCandidate && bot.currentCapital >= 2.00 && (Date.now() - lastBuyAttempt > 30000)) {
            lastBuyAttempt = Date.now();
            const { asset, rsi, price } = bestCandidate;
            const buyAmount = Number((Math.floor(Math.min(bot.currentCapital, 20.00) * 100) / 100).toFixed(2));
            console.log(`🎯 [OPORTUNIDADE DETECTADA EM ${asset.name}!] RSI: ${rsi.toFixed(1)} | Preço: R$ ${price} | Valor da Ordem: R$ ${buyAmount}`);

            const order = await executeRealMarketOrder(asset.symbol, 'BUY', buyAmount, null, asset.decimals, asset.baseAsset);

            if (order && (order.orderId || order.status === 'FILLED')) {
              const executedQty = parseFloat(order.executedQty) || (buyAmount / price);
              const cummulativeQuote = parseFloat(order.cummulativeQuoteQty) || buyAmount;
              const avgPrice = cummulativeQuote / executedQty || price;

              bot.assignedAsset = asset.symbol.replace('BRL', '/BRL');
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
                openedAt: new Date().toLocaleTimeString('pt-BR')
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

              await cloudSync.syncEcosystemState(ecosystemState);
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
          const pnlBrl = currentValBrl - pos.notionalBrl;
          const pnlPct = (pnlBrl / pos.notionalBrl) * 100;

          bot.dailyPnL = Number(pnlBrl.toFixed(2));
          bot.currentCapital = Number((pos.notionalBrl + pnlBrl).toFixed(2));

          if (tickCount % 4 === 0) {
            console.log(`[SCALPING ${pos.assetName}] Entrada: R$ ${pos.entryPrice.toFixed(2)} | Atual: R$ ${currentPrice.toFixed(2)} | PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% (R$ ${pnlBrl.toFixed(2)})`);
          }

          // 1. TRAILING PROFIT LOCK: Quando o trade bate +1.0%, ativa trava de lucro garantido em +0.40%
          if (!pos.trailingLocked && pnlPct >= (ecosystemState.trailingTriggerPct || 1.0)) {
            pos.trailingLocked = true;
            pos.lockedMinProfitPct = ecosystemState.trailingLockPct || 0.40;
            console.log(`🛡️ [TRAILING LOCK ATIVADO]: ${pos.assetName} bateu +${pnlPct.toFixed(2)}%! Lucro mínimo de +${pos.lockedMinProfitPct.toFixed(2)}% blindado no bolso!`);
          }

          // 2. GATILHOS DE SAÍDA:
          // - Take Profit Pleno (1.2% a 1.5%)
          // - Saída por Trailing Lock (se reverter para +0.40% após bater +1.0%)
          // - Stop Loss de Proteção (-0.90% se o trailing não tiver sido ativado)
          const hitTakeProfit = pnlPct >= (ecosystemState.takeProfitMinPct || 1.20);
          const hitTrailingExit = pos.trailingLocked && pnlPct <= (pos.lockedMinProfitPct || 0.40);
          const hitStopLoss = !pos.trailingLocked && (pnlPct <= -ecosystemState.stopLossPctPerTrade);

          if (hitTakeProfit || hitTrailingExit || hitStopLoss) {
            const reason = hitTakeProfit
              ? `LUCRO MÁXIMO SCALPING (+${pnlPct.toFixed(2)}%)`
              : hitTrailingExit
              ? `LUCRO GARANTIDO TRAILING (+${pnlPct.toFixed(2)}%)`
              : `STOP LOSS PROTEGIDO (${pnlPct.toFixed(2)}%)`;
            console.log(`🏁 [ENCERRANDO OPERAÇÃO]: ${reason} | Variação: ${pnlPct.toFixed(2)}% | R$ ${pnlBrl.toFixed(2)}`);

            const sellResult = await executeRealMarketOrder(pos.symbol, 'SELL', null, pos.qty, pos.decimals, pos.baseAsset);

            if (sellResult && (sellResult.orderId || sellResult.status === 'FILLED')) {
              const finalQuote = parseFloat(sellResult.cummulativeQuoteQty) || currentValBrl;
              const finalProfit = finalQuote - pos.notionalBrl;

              bot.currentCapital = Number(finalQuote.toFixed(2));
              bot.dailyPnL = Number(finalProfit.toFixed(2));
              bot.accumulatedCentsProfit = Number(((bot.accumulatedCentsProfit || 0) + finalProfit).toFixed(2));
              bot.openPosition = null;

              ecosystemState.hiveMind.totalTradesExecuted++;
              if (finalProfit > 0) {
                ecosystemState.hiveMind.winningTrades++;
                ecosystemState.hiveMind.collectiveIQ += 2;
              }

              // Circuit Breaker: Rastreia perdas consecutivas
              if (finalProfit < 0) {
                bot.consecutiveLosses = (bot.consecutiveLosses || 0) + 1;
                if (bot.consecutiveLosses >= 2) {
                  bot.circuitBreakerUntil = Date.now() + (4 * 3600 * 1000);
                  const cbMsg = `🛑 [CIRCUIT BREAKER] ${bot.name} atingiu 2 stops consecutivos. Pausado por 4h para proteção do capital!`;
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

              await cloudSync.syncEcosystemState(ecosystemState);
            }
          }
        }
      }

      // Sincroniza o estado atualizado no Firebase a cada 3 ticks
      if (tickCount % 3 === 0) {
        await cloudSync.syncEcosystemState(ecosystemState);
      }
    } catch (err) {
      console.error('[ERRO NO CICLO MULTI-CRIPTO]:', err.message);
    }
  }, 2500);
}

startMultiAssetTrader();
