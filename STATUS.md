# 📊 STATUS DO PROJETO - NEXUS DARWIN AI
**Última Atualização:** 03 de Outubro de 2026  
**Status Operacional:** 🟢 100% OPERACIONAL & ONLINE NA BINANCE REAL (CONEXÃO VALIDADA) + SIMULADOR ALPACA ATIVO

---

## 1. 💼 Saldo Real Atual na Binance Brasil
* **BRL Livre (Spot):** R$ 20,58 (Disponível para novas oportunidades de repique)  
* **Dólar Digital (Cofre USDC no Simple Earn flexível):** 1.8235 USDC (~R$ 9,56 rendendo juros diários)  
* **Cripto em Operação no Scalping:**
  * **Robô #1 (Alpha Titans):** 0.031 SOL (Entrada: R$ 625,90 | ~R$ 19,43 em operação)
  * **Robô #2 (Beta Speed):** 0.0012446 BNB (Entrada: R$ 4.039,00 | ~R$ 5,03 em operação)
* **Patrimônio Total Real na Conta:** **R$ 54,51**  
* **Regra de Ouro Ativa:** 80% do lucro reinvestido para escalar os robôs / 20% varrido para o cofre seguro de emergência.

---

## 2. 🧠 Central Estratégica da IA (Grok & Groq LPU)
O ecossistema conta agora com um Conselho de Inteligência Artificial integrado ao motor de risco:
* **Groq LPU (Hardware de Ultra-Velocidade):**
  * Modelo: `openai/gpt-oss-120b` (120 Bilhões de parâmetros).
  * Latência recorde: **~900ms** (menos de 1 segundo de tempo de resposta).
  * Chave configurada: API Key oficial da Groq ativa.
* **Grok 2.0 (xAI de Elon Musk):**
  * Suporte nativo implementado em `grok_advisor.js` para integração imediata via `xai-...`.
* **Função no Ecossistema:**
  * Avalia o índice de força do mercado nos 16 pares monitorados.
  * Define se o ambiente é de "Scalp com Trailing" ou "Defensivo".
  * Fornece parecer estratégico em português do Brasil direcionado ao operador (Pablo).
  * Alimenta o Firebase Realtime Database em `/nexus_darwin_ecosystem/grokAdvisor.json`.

---

## 3. 🕯️ HUD de Velas (Candlesticks) & Entrada dos Robôs
* **Gráfico Oficial TradingView (style=1 - Candlesticks Japoneses):**
  * Intervalos selecionáveis: 1m, 5m, 15m, 1h.
  * Seletores instantâneos: Velas SOL (Robô #1), Velas BNB (Robô #2), BTC, ETH, XRP, DOGE.
* **Termômetro Visual do Trade:**
  * Mostra onde o preço da vela atual está exatamente posicionado entre o Stop Loss e o Take Profit.
  * **Alvo de Lucro:** +1,50%
  * **Trailing Stop:** +1,00% (com trava mínima garantida de +0,40%)
  * **Stop Loss:** -0,90%
* **Radar Dinâmico Multi-Cripto (16 Ativos Líquidos em BRL):**
  * BTC, ETH, SOL, BNB, XRP, DOGE, ADA, LINK, AVAX, NEAR, SUI, RENDER, LTC, POL, PEPE, USDC.
  * Tabela com Preço, Variação 24h, RSI (Sobrevenda/Sobrecompra), Tendência e Status.
* **Histórico de Ordens Reais:**
  * Tabela com PnL flutuante ao vivo e PnL realizado.

---

## 4. 🌐 Status das Plataformas & Produção Vercel
* **Dashboard Oficial de Produção:**
  * **URL:** `https://nexus-darwin-ai.vercel.app/` (HTTP 200 OK | Versão v=4.0.2).
  * Exibe os 4 KPIs de Capital, Central da IA Grok/Groq, HUD de Velas, Radar de 16 ativos e Ordens.
* **Página da Bolsa Americana (Alpaca Paper Trading):**
  * **URL:** `https://nexus-darwin-ai.vercel.app/alpaca.html` (HTTP 200 OK).
  * Erro 404 resolvido definitivamente com o deployer direto da Vercel.
* **Publicador Direto da Vercel (`deploy_to_vercel.js`):**
  * Faz upload direto via API REST (`POST /v2/files` + `POST /v13/deployments`).
  * Bypassa limitações de escopo do CLI da Vercel para tokens de projeto.
  * Script de 1 clique: `PUBLICAR_AGORA.bat`.
* **Operador Local em Execução:**
  * `real_binance_operator.js` rodando em background conectado à Binance Brasil e Firebase RTDB.

---

## 5. 🇺🇸 Próxima Fase: Expansão Wall Street (Alpaca Paper Trading)
* **Ambiente:** Simulador Demo de Ações Americanas (NYSE / NASDAQ).
* **Capital Virtual:** $100.000,00 USD (Paper Trading isolado da Binance Real).
* **Ativos-Alvo:** AAPL (Apple), TSLA (Tesla), NVDA (Nvidia), MSFT (Microsoft), SPY (S&P 500), AMZN (Amazon).
* **Objetivo Imediato:**
  1. Conectar chaves de Paper Trading da Alpaca.
  2. Testar ordens fracionadas automáticas via API `/api/alpaca-order`.
  3. Criar robô de swing trade/scalping em ações americanas rodando em paralelo aos robôs de cripto.
