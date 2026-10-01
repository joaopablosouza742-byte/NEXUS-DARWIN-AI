# 🤖 CLAUDE.md - Diretrizes do Projeto NEXUS DARWIN AI

## 📌 Visão Geral do Projeto
O **NEXUS DARWIN AI** é um sistema de trading algorítmico quantitativo autônomo baseado em enxame evolutivo (Swarm Intelligence). O sistema opera com **dinheiro 100% real** na **Binance Brasil (Spot & Convert)**, com planos de expansão multimercado para a **Bolsa Americana (Alpaca)**.

**Objetivo Central:** Iniciar com banca fracionária, operar scalping inteligente de curto prazo (1.2% a 1.5%), acumular lucros centavo a centavo, transferir cada +R$ 10,00 de lucro para o Cofre (Binance Funding Wallet) e clonar robôs automaticamente até atingir a escala de 100 robôs operando simultaneamente.

---

## 🏗️ Arquitetura e Componentes

1. **Motor Operador Local (`real_binance_operator.js`):**
   - Executa no computador local (Node.js) conectado diretamente à API oficial da Binance.
   - Implementa HMAC-SHA256 para requisições assinadas seguras.
   - Utiliza Binance Convert API (`/sapi/v1/convert`) para contornar restrições de `MIN_NOTIONAL` em ordens sub-R$ 10, com taxa zero.
   - Sincroniza o estado oficial com o Firebase Realtime Database.

2. **Radar Dinâmico de Mercado (PILAR A):**
   - Monitora 16 pares líquidos em Reais: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, LINK, AVAX, NEAR, SUI, RENDER, LTC, POL, PEPE, USDC.
   - Seleciona o ativo com melhor ponto de assimetria técnica (RSI em sobrevenda + médias móveis alinhadas).

3. **Gestão de Risco e Saída:**
   - **Take Profit:** +1.20% a +1.50%.
   - **Trailing Profit Lock:** Ao atingir +1.00%, ativa trava garantindo saída mínima com +0.40% de lucro no bolso caso o mercado reverta.
   - **Stop Loss:** -0.90% para operações que não evoluem favoravelmente.
   - **Cooldown:** 30 segundos entre tentativas de entrada para evitar esgotamento de quota de requisições da Binance.

4. **Dashboard Web Frontend (`index.html`, `app.js`, `styles.css`):**
   - Hospedado na **Vercel** (`https://nexus-darwin-ai.vercel.app/`).
   - Leitor em tempo real do Firebase (modo somente-leitura; zero simulação fake).
   - Widgets oficiais do TradingView para acompanhamento de velas em tempo real de cada ativo monitorado.

5. **Servidor Cloud Opcional (`server.js`, `railway.json`, `Procfile`):**
   - Configurado para deploy contínuo no Railway caso o usuário opte por rodar em nuvem 24/7.

---

## 🛠️ Comandos Principais

* **Iniciar Operador Real (Local):**
  ```powershell
  node real_binance_operator.js
  # Ou execute:
  .\INICIAR_OPERADOR_REAL.bat
  ```
* **Verificar IP Público Atual:**
  ```powershell
  node -e "require('https').get('https://api.ipify.org?format=json', r => { let d=''; r.on('data', c=>d+=c); r.on('end', ()=>console.log(d)); });"
  ```
* **Testar Conexão com a Binance API:**
  ```powershell
  node check_binance.js
  ```
* **Enviar Alterações para GitHub / Vercel:**
  ```powershell
  git add .
  git commit -m "feat: sua mensagem"
  git push origin main
  ```

---

## ⚠️ Regras Críticas e Restrições Invioláveis

1. **Zero Simulação Fake:** O sistema opera com saldos e ordens 100% reais. Nunca reintroduzir geradores de números aleatórios (`Math.random()`) para criar trades fictícios no dashboard.
2. **Restrição de IP na Binance:** O provedor residencial pode rotacionar o IP público. Sempre verificar se o IP da máquina atual está autorizado nas configurações de API da Binance antes de inicializar o operador.
3. **Filtro NOTIONAL da Binance:** O livro Spot impõe valor mínimo de R$ 10,00 por ordem. Ordens menores ou frações decimais devem ser roteadas via Binance Convert API (`executeConvertTrade`), que aceita a partir de R$ 0,05.
4. **Proteção de Capital:** Nunca remover o Stop Loss ou o Trailing Profit Lock. Cada robô tem risco estritamente limitado ao seu capital alocado.
