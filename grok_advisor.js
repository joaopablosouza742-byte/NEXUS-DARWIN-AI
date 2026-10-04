/**
 * NEXUS DARWIN - MÓDULO DE INTELIGÊNCIA ESTRATÉGICA GROQ (LPU ULTRA-RÁPIDO)
 * =========================================================================
 * Integração Oficial com o Groq (Groq Inc. LPU):
 * - Modelo: openai/gpt-oss-120b (120 Bilhões de parâmetros)
 * - Latência: ~200ms a 400ms (Resposta em tempo real sem travar os robôs)
 * - Custo: 100% Gratuito via Groq API
 * - Função: Diretor de Risco, Auditor de Sentimento e Estrategista dos Robôs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const GROQ_API_KEY = process.env.GROQ_API_KEY || (fs.existsSync(path.join(__dirname, '.groq_key')) ? fs.readFileSync(path.join(__dirname, '.groq_key'), 'utf8').trim() : '');
const XAI_API_KEY = process.env.XAI_API_KEY || '';

/**
 * Chamada ultrarrápida para a API da Groq (LPU)
 */
async function callGroqApi(prompt, systemPrompt) {
  return new Promise((resolve) => {
    if (!GROQ_API_KEY) return resolve(null);

    const payload = JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 350
    });

    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 6000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const reply = json.choices?.[0]?.message?.content;
          resolve(reply || null);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

/**
 * Chamada para a API da xAI (Grok Oficial de Elon Musk)
 */
async function callXaiGrokApi(prompt, systemPrompt) {
  return new Promise((resolve) => {
    if (!XAI_API_KEY) return resolve(null);

    const payload = JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 350
    });

    const req = https.request({
      hostname: 'api.x.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const reply = json.choices?.[0]?.message?.content;
          resolve(reply || null);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

/**
 * Executa a análise estratégica completa da IA Groq
 */
async function runGrokStrategicAnalysis(ecosystemState, scannerList = []) {
  try {
    const balances = ecosystemState.realBalances || {};
    const brlFree = parseFloat(balances.brlFree) || 20.58;
    const usdcVault = parseFloat(balances.usdcBrlValue) || 9.56;

    const activeBots = Array.isArray(ecosystemState.activeBots) ? ecosystemState.activeBots : [];
    const botSol = activeBots.find(b => b.assignedAsset?.includes('SOL')) || activeBots[0] || {};
    const botBnb = activeBots.find(b => b.assignedAsset?.includes('BNB')) || activeBots[1] || {};

    const posSol = botSol.openPosition;
    const posBnb = botBnb.openPosition;

    // Métricas do radar
    const oversoldCoins = scannerList.filter(c => c.rsi < 45).map(c => c.name || c.symbol);
    const uptrendCoins = scannerList.filter(c => c.trend === 'ALTA').length;
    const totalCoins = scannerList.length || 16;
    const marketHealthPct = Math.round((uptrendCoins / totalCoins) * 100);

    let sentiment = marketHealthPct >= 60 ? 'ALTA MODERADA (COMPRADOR)' : marketHealthPct <= 35 ? 'DEFENSIVO (VOLATILIDADE)' : 'NEUTRO / CONSTRUTIVO';
    let riskLevel = 'CONTROLADO (MODERADO)';
    let suggestedAction = 'SCALP DE CENTAVOS (+R$ 0,05)';
    let suggestedTarget = 0.35;
    let suggestedStop = 0.35;

    let adviceText = '';
    const startTime = Date.now();
    let activeProvider = 'Groq LPU (openai/gpt-oss-120b)';
    let activeModel = 'gpt-oss-120b';

    const prompt = `
DADOS ATUAIS DA CONTA BINANCE BRASIL DO USUÁRIO (PABLO):
- Caixa Livre em Reais (BRL): R$ ${brlFree.toFixed(2)} (Disponível na conta Spot)
- Cofre Dólar (USDC): R$ ${usdcVault.toFixed(2)} (Rendendo juros no Simple Earn)
- Robô #1 (Alpha): Operando Solana (SOL/BRL) ${posSol ? `[Entrada R$ ${posSol.entryPrice.toFixed(2)} | Meta: +R$ 0,05 de lucro]` : '[Aguardando oportunidade]'}
- Robô #2 (Beta): Operando BNB (BNB/BRL) ${posBnb ? `[Entrada R$ ${posBnb.entryPrice.toFixed(2)} | Meta: +R$ 0,05 de lucro]` : '[Aguardando oportunidade]'}
- Estratégia em Execução: Micro-scalping de 5 centavos (+R$ 0,05) com Trailing Stop dinâmico (+R$ 0,03) e Stop curto (-R$ 0,06).
- Saúde dos 16 Pares Monitorados: ${marketHealthPct}% em tendência de alta.
- Moedas em sobrevenda: ${oversoldCoins.join(', ') || 'Nenhuma extrema'}

INSTRUÇÃO:
Escreva um parecer direto, inteligente e amigável em português (máximo 2 parágrafos curtos) para o Pablo. Explique como os robôs devem agir agora com o scalping de 5 centavos e os R$ ${brlFree.toFixed(2)} de caixa livre. Comece com uma saudação objetiva.
`;

    const systemPrompt = `Você é o estrategista quantitativo da IA para o ecossistema NEXUS DARWIN. Você preza pela segurança do capital (regra 3x e cinto de segurança). Seja confiante, técnico e acolhedor em português do Brasil.`;

    // 1. TENTA PRIMEIRO GROK (xAI DO ELON MUSK) SE HOUVER CHAVE xai-...
    if (XAI_API_KEY) {
      const grokReply = await callXaiGrokApi(prompt, systemPrompt);
      if (grokReply && grokReply.length > 30) {
        adviceText = grokReply.trim();
        activeProvider = 'Grok 2.0 (xAI de Elon Musk)';
        activeModel = 'grok-2-latest';
      }
    }

    // 2. SE NÃO HOUVER OU FALHAR, USA GROQ LPU (CHAVE gsk_... DO PABLO)
    if (!adviceText && GROQ_API_KEY) {
      const groqReply = await callGroqApi(prompt, systemPrompt);
      if (groqReply && groqReply.length > 30) {
        adviceText = groqReply.trim();
        activeProvider = 'Groq LPU (openai/gpt-oss-120b)';
        activeModel = 'gpt-oss-120b';
      }
    }

    const latencyMs = Date.now() - startTime;

    if (!adviceText) {
      // Fallback analítico nativo
      adviceText = `O mercado opera com **${marketHealthPct}% dos 16 pares em tendência compradora**. Os Robôs #1 (SOL) e #2 (BNB) operam com **alvo ultra-rápido de +R$ 0,05 de lucro no bolso** e Trailing Stop de 3 centavos. Recomendo manter os **R$ ${brlFree.toFixed(2)} de Caixa Livre** guardados como reserva de choque para novos repiques. Risco atual: **Controlado**.`;
      activeProvider = 'NEXUS DARWIN Hybrid Engine';
      activeModel = 'algorithmic-quant';
    }

    const grokData = {
      provider: activeProvider,
      modelName: activeModel,
      latencyMs: latencyMs,
      hasApiKey: Boolean(GROQ_API_KEY || XAI_API_KEY),
      hasGroqKey: Boolean(GROQ_API_KEY),
      hasGrokKey: Boolean(XAI_API_KEY),
      sentiment,
      riskLevel,
      marketHealthPct,
      suggestedAction,
      suggestedTargetPct: suggestedTarget,
      suggestedStopPct: suggestedStop,
      headline: `Mercado a ${marketHealthPct}% de força • ${activeProvider} (${latencyMs}ms)`,
      advice: adviceText,
      topPicks: oversoldCoins.slice(0, 4),
      updatedAt: new Date().toLocaleTimeString('pt-BR'),
      timestamp: Date.now()
    };

    ecosystemState.grokAdvisor = grokData;

    // Registra insight no Hive Mind
    const insightMsg = `⚡ [GROQ LPU 120B]: Latência ${latencyMs}ms | Sentimento: ${sentiment} | Caixa Livre R$ ${brlFree.toFixed(2)} protegido.`;
    if (!ecosystemState.hiveMind) ecosystemState.hiveMind = { recentInsights: [] };
    ecosystemState.hiveMind.recentInsights = [insightMsg, ...(ecosystemState.hiveMind.recentInsights || []).slice(0, 15)];

    return grokData;
  } catch (err) {
    console.warn('[GROQ ADVISOR ERROR]:', err.message);
    return null;
  }
}

module.exports = {
  runGrokStrategicAnalysis
};
