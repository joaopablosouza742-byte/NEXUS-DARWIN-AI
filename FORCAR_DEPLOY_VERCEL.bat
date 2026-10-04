@echo off
title NEXUS DARWIN - FORCAR DEPLOY PRODUCAO VERCEL
color 0B
echo ======================================================================
echo           NEXUS DARWIN AI - FORCAR DEPLOY PRODUCAO NO VERCEL
echo ======================================================================
echo.
cd /d "%~dp0"

echo [1/3] Garantindo sincronizacao com o GitHub...
git add .
git commit -m "feat: sincronizacao para deploy em producao" >nul 2>&1
git push origin main
echo.

echo [2/3] Verificando conexao com a conta Vercel...
call npx vercel whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Necessario conectar a conta Vercel uma unica vez.
    echo Escolha "Continue with GitHub" ou "Continue with Email":
    echo.
    call npx vercel login
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha no login da Vercel.
        pause
        exit /b 1
    )
)

echo.
echo [3/3] Enviando arquivos locais direto para PRODUCAO na Vercel...
call npx vercel --prod --yes

echo.
echo ======================================================================
echo               DEPLOY EM PRODUCAO FINALIZADO!
echo.
echo   Painel Principal: https://nexus-darwin-ai.vercel.app/
echo   Painel Alpaca:   https://nexus-darwin-ai.vercel.app/alpaca.html
echo ======================================================================
echo.
pause
