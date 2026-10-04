@echo off
title NEXUS DARWIN AI - Zerar Posicoes para Real
color 0C
cls

cd /d "%~dp0"

echo ===================================================================
echo   NEXUS DARWIN AI - LIQUIDACAO DE SEGURANCA ANTES DE DESLIGAR
echo ===================================================================
echo Este script vai vender suas criptomoedas abertas a mercado na Binance
echo e deixar 100%% do seu capital protegido em Reais (BRL).
echo.
pause

node zerar_tudo_para_real.js

echo.
echo ===================================================================
echo   Tudo pronto! Seu saldo esta seguro em Real (BRL).
echo   Agora voce pode desligar o computador tranquilamente.
echo ===================================================================
pause
