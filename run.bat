@echo off
title Video Support Platform (Standalone Dev)
cls
echo ==============================================
echo   STARTING VIDEO SUPPORT PLATFORM (STANDALONE) 
echo ==============================================
echo Backend API  : http://localhost:4000
echo Frontend Web : http://localhost:3000
echo Mode         : Standalone SQLite, Local Files, Local Cache
echo Press Ctrl+C to terminate both servers.
echo ----------------------------------------------
npm run dev
