const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(__dirname, '..', 'telegram_config.json');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          resolve({ ok: false, error: d });
        }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          resolve({ ok: false, error: d });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method === 'GET') {
    let cfg = { botToken: '', chatId: '', enabled: false };
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }
    } catch (e) {}

    // Mascara o token para exibição segura
    const masked = cfg.botToken ? `${cfg.botToken.slice(0, 6)}...${cfg.botToken.slice(-4)}` : '';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      hasToken: Boolean(cfg.botToken),
      maskedToken: masked,
      botToken: cfg.botToken, // Retorna também o token para edição rápida
      chatId: cfg.chatId || '',
      enabled: Boolean(cfg.enabled)
    }));
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    } catch (e) {}

    const { botToken, chatId, test } = body;

    let cfg = { botToken: '', chatId: '', enabled: false };
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }
    } catch (e) {}

    if (botToken) cfg.botToken = botToken.trim();
    if (chatId) cfg.chatId = chatId.trim();
    cfg.enabled = Boolean(cfg.botToken && cfg.chatId);

    // Se for teste e não tem chatId digitado, descobre automaticamente pelo getUpdates
    if (test && cfg.botToken && !cfg.chatId) {
      try {
        const updates = await httpsGet(`https://api.telegram.org/bot${cfg.botToken}/getUpdates`);
        if (updates.ok && Array.isArray(updates.result) && updates.result.length > 0) {
          const lastMsg = updates.result[updates.result.length - 1];
          const detected = (lastMsg.message && lastMsg.message.chat) ? lastMsg.message.chat.id : null;
          if (detected) {
            cfg.chatId = String(detected);
            cfg.enabled = true;
          }
        } else {
          // Usuário ainda não clicou em Start ou mandou mensagem pro robô
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            success: false,
            needStart: true,
            message: 'Abra a conversa com seu robô no Telegram (@robobinace_bot) e clique em "COMEÇAR / START" (ou envie uma mensagem "oi") antes de testar!'
          }));
        }
      } catch (err) {
        console.error('[ERRO GETUPDATES]:', err.message);
      }
    }

    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    } catch (e) {}

    // Se for teste, envia mensagem de verificação
    if (test && cfg.botToken && cfg.chatId) {
      const testMsg = `🚀 <b>[NEXUS DARWIN AI] Conexão Testada com Sucesso!</b>\n\n` +
        `Seu robô de cripto agora está oficialmente conectado ao seu celular via Telegram!\n` +
        `Você receberá notificações instantâneas a cada compra e venda no lucro.\n\n` +
        `Comandos úteis:\n` +
        `/saldo - Consultar sua banca na Binance\n` +
        `/status - Ver operações e alvos em andamento\n` +
        `/zerar - Vender posições e voltar tudo para Real\n` +
        `/ajuda - Lista de comandos`;

      try {
        const resp = await httpsPost(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
          chat_id: cfg.chatId,
          text: testMsg,
          parse_mode: 'HTML'
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          success: resp.ok,
          chatId: cfg.chatId,
          result: resp
        }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      saved: true,
      chatId: cfg.chatId || '',
      enabled: cfg.enabled
    }));
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
};
