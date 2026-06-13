# Standalone Dev Server Startup Script
Clear-Host
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  STARTING VIDEO SUPPORT PLATFORM (STANDALONE) " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Backend API  : http://localhost:4000" -ForegroundColor Green
Write-Host "Frontend Web : http://localhost:3000" -ForegroundColor Green
Write-Host "Mode         : Standalone SQLite, Local Files, Local Cache" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to terminate both servers." -ForegroundColor Gray
Write-Host "----------------------------------------------"

npm run dev
