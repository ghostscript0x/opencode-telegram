@echo off
title OpenCode × Telegram Plugin — Setup
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────────
::  OpenCode × Telegram Plugin
::  Mirror sessions to Telegram and control them remotely
::  ─────────────────────────────────────────────────────
::  Copyright (c) 2026 ghostscript0x
::  MIT License — see LICENSE file for full terms
::  ─────────────────────────────────────────────────────
::  Just double-click and go.
:: ─────────────────────────────────────────────────────

:: Detect where we are
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: ─── Check Node.js ───
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    cls
    echo.
    echo   ╔═══════════════════════════════════════════════╗
    echo   ║           ❌  Node.js not found              ║
    echo   ╚═══════════════════════════════════════════════╝
    echo.
    echo   You need Node.js to run this plugin.
    echo.
    echo   Download it from: https://nodejs.org
    echo.
    echo   Then run this file again.
    echo.
    pause
    exit /b 1
)

:: ─── Check if dist/index.js exists (build check) ───
if not exist "%SCRIPT_DIR%dist\index.js" (
    cls
    echo.
    echo   ╔═══════════════════════════════════════════════╗
    echo   ║        🔧  First time setup...               ║
    echo   ╚═══════════════════════════════════════════════╝
    echo.
    echo   Installing dependencies and building...
    echo.
    call npm install >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo   ❌ npm install failed. Check your internet.
        pause
        exit /b 1
    )
    echo   ✅ Dependencies installed.
    echo.
    call npx tsc >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo   ❌ Build failed.
        pause
        exit /b 1
    )
    echo   ✅ Plugin built successfully.
    echo.
    timeout /t 1 /nobreak >nul
)

:: ─── Launch the interactive menu ───
cls
echo.
echo   ╔═══════════════════════════════════════════════╗
echo   ║       🚀  Launching Interactive Menu...       ║
echo   ╚═══════════════════════════════════════════════╝
echo.
timeout /t 1 /nobreak >nul

cls
node "%SCRIPT_DIR%dist\menu.js"

:: ─── After menu closes ───
cls
echo.
echo   ╔═══════════════════════════════════════════════╗
echo   ║        Thanks for using the plugin!           ║
echo   ╚═══════════════════════════════════════════════╝
echo.
echo   Restart OpenCode to apply any changes.
echo.
echo   Press any key to close this window...
pause >nul
exit /b 0
