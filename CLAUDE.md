# 🤖 CLAUDE.md - Diretrizes do Projeto NEXUS DARWIN AI

## 📌 Visão Geral do Projeto
O **NEXUS DARWIN AI** é um ecossistema de trading quantitativo autônomo baseado em enxame evolutivo (Swarm Intelligence) e conselho estratégico de IA (Grok xAI & Groq LPU).
O sistema opera em dois ambientes estritamente isolados:
1. **Ambiente Real (Binance Brasil):** Scalping em Reais (BRL) e Dólares Digitais (USDC) na Spot & Binance Convert API, com gestão de risco 3x e blindagem de capital.
2. **Ambiente Demo (Bolsa Americana - Alpaca):** Simulador de Paper Trading ($100.000 USD) para ações fracionadas na NYSE e NASDAQ (Apple, Tesla, Nvidia, SPY, etc.).

---

## 🏗️ Arquitetura e Componentes

1. **Motor Operador Local Binance (`real_binance_operator.js`):**
   - Executa no computador local (Node.js) conectado diretamente à API oficial da Binance.
   - Implementa HMAC-SHA256 para requisições assinadas seguras.
   - Utiliza Binance Convert API (`/sapi/v1/convert`) para contornar restrições de `MIN_NOTIONAL` em ordens sub-R$ 10, com taxa zero.
   - Sincroniza o ecossistema com o Firebase Realtime Database.

2. **Conselho Estratégico de Inteligência Artificial (`grok_advisor.js`):**
   - **Groq LPU:** Conexão ultrarrápida (~900ms) usando chip LPU e modelo de 120B parâmetros (`openai/gpt-oss-120b`).
   - **Grok 2.0 (xAI):** Suporte nativo para API oficial da xAI (`grok-2-latest`).
   - Avalia a saúde dos 16 pares líquidos, define o sentimento e estabelece parâmetros de stop e target personalizados.

3. **Dashboard Web Frontend (`index.html`, `app.js`, `styles.css`):**
   - Hospedado na **Vercel** (`https://nexus-darwin-ai.vercel.app/`).
   - Sincronização em tempo real via Firebase Realtime Database (modo somente-leitura; zero simulação fake no painel real).
   - HUD de Velas / Candlesticks ao vivo (TradingView style=1) com termômetro dinâmico de entrada, stop loss (-0.90%), trailing stop (+1.00%) e alvo (+1.50%).
   - Radar dinâmico dos 16 pares líquidos em BRL com cálculo de RSI e status de sobrevenda.

4. **Simulador Alpaca Wall Street (`alpaca.html`, `alpaca.js`, `api/alpaca-order.js`):**
   - Hospedado em `https://nexus-darwin-ai.vercel.app/alpaca.html`.
   - Ambiente 100% simulado (Paper Trading) com $100.000 virtuais.
   - Gráficos oficiais de ações americanas e formulário de ordens fracionadas sem risco.

5. **Deployer de Produção Vercel (`deploy_to_vercel.js` / `PUBLICAR_AGORA.bat`):**
   - Publicador direto via API REST da Vercel (`POST /v2/files` + `POST /v13/deployments`), contornando limitações de tokens de projeto do CLI da Vercel.

---

## 🛠️ Comandos Principais

* **Iniciar Operador Real (Local):**
  ```powershell
  node real_binance_operator.js
  # Ou execute:
  .\INICIAR_OPERADOR_REAL.bat
  ```
* **Publicar Alterações na Vercel (Produção Instantânea):**
  ```powershell
  node deploy_to_vercel.js
  # Ou duplo clique em:
  .\PUBLICAR_AGORA.bat
  ```
* **Verificar IP Público Atual:**
  ```powershell
  node -e "require('https').get('https://api.ipify.org?format=json', r => { let d=''; r.on('data', c=>d+=c); r.on('end', ()=>console.log(d)); });"
  ```
* **Testar Conexão com a Binance API:**
  ```powershell
  node check_binance.js
  ```
* **Enviar Alterações para o GitHub:**
  ```powershell
  git add .
  git commit -m "feat: sua mensagem"
  git push origin main
  ```

---

## ⚠️ Regras Críticas e Restrições Invioláveis

1. **Separação Rígida de Ambientes:** Nunca misturar a lógica de Paper Trading da Alpaca (`alpaca.html`) com a conta de dinheiro real da Binance (`index.html`). O saldo da Binance nunca pode ser afetado por testes do simulador.
2. **Zero Simulação Fake na Binance Real:** No painel da Binance (`index.html`), nunca reintroduzir números aleatórios (`Math.random()`). Todos os saldos, posições e ordens devem refletir a conta real via Firebase.
3. **Restrição de IP na Binance:** O provedor residencial pode rotacionar o IP público. Sempre verificar se o IP da máquina atual está autorizado nas configurações de API da Binance antes de inicializar o operador.
4. **Filtro NOTIONAL da Binance:** O livro Spot impõe valor mínimo de R$ 10,00 por ordem. Ordens menores ou frações decimais devem ser roteadas via Binance Convert API (`executeConvertTrade`), que aceita a partir de R$ 0,05 com taxa zero.
5. **Proteção de Capital:** Nunca desativar o Stop Loss (-0.90%) ou o Trailing Profit Lock (+1.00% c/ +0.40% garantido).
