@echo off
title Forcar Deploy do NEXUS DARWIN no Vercel
cd /d "%~dp0"
echo ======================================================================
echo   NEXUS DARWIN AI - FORCAR DEPLOY DE PRODUCAO NO VERCEL
echo ======================================================================
echo.
echo [1/3] Enviando arquivos locais para o GitHub...
git add .
git commit -m "feat: deploy atualizado com radar, velas de entrada e alpaca"
git push origin main
echo.
echo [2/3] Executando deploy forçado direto pelo Vercel CLI...
echo Se abrir uma janela no navegador, clique em "Confirm" para autorizar.
call vercel deploy --prod --yes
echo.
echo ======================================================================
echo   DEPLOY FINALIZADO COM SUCESSO!
echo   Painel Principal: https://nexus-darwin-ai.vercel.app
echo   Painel Alpaca Demo: https://nexus-darwin-ai.vercel.app/alpaca.html
echo ======================================================================
pause
