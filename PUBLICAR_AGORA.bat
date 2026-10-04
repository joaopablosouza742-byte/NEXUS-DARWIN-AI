@echo off
title NEXUS DARWIN - PUBLICADOR VERCEL
color 0A
echo ======================================================================
echo           NEXUS DARWIN AI - PUBLICADOR DIRETO NA VERCEL
echo ======================================================================
echo.
cd /d "%~dp0"

echo Enviando arquivos diretamente para PRODUCAO na Vercel...
echo.
node deploy_to_vercel.js

echo.
pause
