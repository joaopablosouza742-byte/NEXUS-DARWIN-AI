/**
 * NEXUS DARWIN AI - MÓDULO DE INTEGRAÇÃO TELEGRAM (CONTROLE REMOTO NO CELULAR)
 * ============================================================================
 * 1. Envia notificações em tempo real no seu celular a cada Compra, Venda e Lucro no bolso!
 * 2. Permite controlar o robô enviando comandos no chat:
 *    /saldo   -> Mostra saldos da Binance em tempo real
 *    /status  -> Mostra os robôs e distância do alvo de lucro
 *    /zerar   -> Vende tudo para Real imediatamente com segurança
 *    /ajuda   -> Mostra lista de comandos
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'telegram_config.json');

class TelegramNotifier {
  constructor() {
    this.config = this.loadConfig();
    this.lastUpdateId = 0;
    this.isPolling = false;
    this.operatorContext = null;
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }
    } catch (e) {}
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: false
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {}
  }

  setOperatorContext(ctx) {
    this.operatorContext = ctx;
  }

  /**
   * Envia uma mensagem para o Telegram do usuário
   */
  async sendMessage(text, parseMode = 'HTML') {
    this.config = this.loadConfig();
    if (!this.config.botToken || !this.config.chatId) return false;

    return new Promise(resolve => {
      const payload = JSON.stringify({
        chat_id: this.config.chatId,
        text: text,
        parse_mode: parseMode
      });

      const req = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${this.config.botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(true));
      });

      req.on('error', () => resolve(false));
      req.write(payload);
      req.end();
    });
  }

  /**
   * Notificação de Compra Realizada
   */
  async notifyBuy(botName, assetName, symbol, amountBrl, price, orderId, targetPrice) {
    const msg = `🟢 <b>[COMPRA EXECUTADA] ${botName}</b>\n\n` +
      `🪙 Ativo: <b>${assetName} (${symbol})</b>\n` +
      `💵 Valor da Compra: <b>R$ ${amountBrl.toFixed(2)}</b>\n` +
      `📍 Preço de Entrada: <b>R$ ${price.toLocaleString('pt-BR')}</b>\n` +
      `🎯 Alvo (+R$ 0,10 Líquido): <b>R$ ${targetPrice.toLocaleString('pt-BR')}</b>\n` +
      `🔖 Ordem Binance: #${orderId}`;
    return this.sendMessage(msg);
  }

  /**
   * Notificação de Venda / Lucro no Bolso
   */
  async notifySell(botName, assetName, symbol, netProfitBrl, grossPnlBrl, feesBrl, exitPrice, totalPatrimony) {
    const isWin = netProfitBrl >= 0;
    const emoji = isWin ? '💰' : '🛡️';
    const title = isWin ? 'LUCRO LÍQUIDO NO BOLSO!' : 'AJUSTE DE SEGURANÇA';

    const msg = `${emoji} <b>[${title}] ${botName}</b>\n\n` +
      `🪙 Ativo: <b>${assetName} (${symbol})</b>\n` +
      `💵 <b>Lucro Líquido no Bolso: ${netProfitBrl >= 0 ? '+' : ''}R$ ${netProfitBrl.toFixed(2)}</b>\n` +
      `📈 Lucro Bruto: +R$ ${grossPnlBrl.toFixed(2)}\n` +
      `⚡ Taxas da Binance: -R$ ${feesBrl.toFixed(2)}\n` +
      `📍 Preço de Saída: <b>R$ ${exitPrice.toLocaleString('pt-BR')}</b>\n` +
      `💼 Patrimônio Total Atual: <b>R$ ${totalPatrimony.toFixed(2)}</b>`;
    return this.sendMessage(msg);
  }

  /**
   * Long Polling para escutar comandos do usuário no Telegram
   */
  startPolling(onCommandCallback) {
    if (this.isPolling) return;
    this.isPolling = true;

    const poll = () => {
      if (!this.isPolling) return;
      this.config = this.loadConfig();

      if (!this.config.botToken) {
        setTimeout(poll, 3000);
        return;
      }

      const url = `/bot${this.config.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
      
      const req = https.get(`https://api.telegram.org${url}`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', async () => {
          try {
            const data = JSON.parse(d);
            if (data.ok && Array.isArray(data.result)) {
              for (const update of data.result) {
                this.lastUpdateId = update.update_id;
                if (update.message && update.message.text) {
                  const text = update.message.text.trim();
                  const fromId = update.message.chat.id;

                  // Se o chatId não estiver configurado, salva automaticamente o do usuário autorizado
                  if (!this.config.chatId) {
                    this.config.chatId = String(fromId);
                    this.saveConfig({ chatId: String(fromId), enabled: true });
                  }

                  if (onCommandCallback) {
                    const reply = await onCommandCallback(text, fromId);
                    if (reply) await this.sendMessage(reply);
                  }
                }
              }
            }
          } catch (e) {}
          setTimeout(poll, 1000);
        });
      });

      req.on('error', () => {
        setTimeout(poll, 5000);
      });
    };

    poll();
    console.log('🤖 [TELEGRAM BOT]: Monitor de comandos do celular ativado com auto-recarga!');
  }
}

const telegramNotifier = new TelegramNotifier();
module.exports = { telegramNotifier };
