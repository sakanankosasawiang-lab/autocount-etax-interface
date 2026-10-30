@echo off
title Flex Interface e-Tax (Autocount to iNet One.th)
echo ========================================================
echo  Starting Flex Interface e-Tax Web Application...
echo  Autocount >> iNet e-Tax One.th
echo ========================================================
echo.

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo Starting server on http://localhost:3000 ...
start http://localhost:3000
node server.js
pause
