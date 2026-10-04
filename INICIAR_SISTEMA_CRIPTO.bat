@echo off
title NEXUS DARWIN AI - Operador Autonomo Binance Brasil
color 0A
cls

cd /d "%~dp0"

echo ===================================================================
echo   NEXUS DARWIN AI - SISTEMA QUANTITATIVO AUTONOMO BINANCE BRASIL
echo ===================================================================
echo [1/3] Iniciando servidor web local...
start "NEXUS WEB SERVER" /b node serve_local.js

echo [2/3] Abrindo painel de controle no navegador...
timeout /t 1 /nobreak >nul
start http://localhost:3000

echo [3/3] Iniciando Robos Autonomos com Memoria Persistente...
echo.

:LOOP
echo [%DATE% %TIME%] Operador real Binance ativo e monitorando mercado...
node real_binance_operator.js
echo.
echo [AVISO]: O processo parou ou foi finalizado.
echo Reiniciando automaticamente em 3 segundos...
timeout /t 3 /nobreak >nul
goto LOOP
