@echo off
title PUBLICAR NEXUS DARWIN NA VERCEL
color 0A
echo ========================================================
echo   NEXUS DARWIN AI - PUBLICADOR DE PRODUCAO VERCEL
echo ========================================================
echo.
cd /d "%~dp0"
echo Enviando arquivos atualizados para a Vercel em Producao...
echo.
npx vercel --prod --yes
echo.
echo ========================================================
echo   DEPLOY CONCLUIDO!
echo   Acesse: https://nexus-darwin-ai.vercel.app/
echo   Alpaca: https://nexus-darwin-ai.vercel.app/alpaca.html
echo ========================================================
pause
