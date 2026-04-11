@echo off
title Impala Launcher
chcp 65001 >nul

echo =========================================
echo    Запуск проекта Impala...
echo =========================================

:: === 1. ЗАПУСК ФРОНТЕНДА (React) ===
echo [1/2] Запуск frontend (npm run dev)...
start "Impala Frontend" cmd /k "cd /d D:\Media\Code\Impala\Impala\impala-app && npm run dev"

:: === 2. ЗАПУСК БЭКЕНДА (в текущем окне) ===
echo [2/2] Настройка окружения и запуск backend...

:: === ЗАГРУЗКА MSVC C++ КОМПИЛЯТОРА ===
:: Note: Verify this path. It might be \Community\ or \Enterprise\ instead of \BuildTools\ depending on what you installed.
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"

cd /d D:\Media\Code\Impala\Impala\impala-app\backend

:: Прописываем нужные пути (ffmpeg и colmap)
set PATH=%PATH%;C:\Users\UKRAiNIANboi\AppData\Local\Microsoft\WinGet\Links
set PATH=%PATH%;D:\Programs\COLMAP\bin

:: Прописываем CUDA
set CUDA_HOME=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4
set PATH=%CUDA_HOME%\bin;%CUDA_HOME%\libnvvp;%PATH%

:: Ограничиваем потоки на всякий случай
set MAX_JOBS=2

:: Активируем виртуальное окружение
call .\venv\Scripts\activate

:: Запускаем сервер
echo Все пути настроены. Стартуем uvicorn!
uvicorn main:app --reload --reload-include "*.py" --reload-exclude "projects.json" --reload-exclude "*.json" --reload-exclude "*.ply" --reload-exclude "*.mp4" --no-access-log

pause