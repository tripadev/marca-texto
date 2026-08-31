@echo off
rem Abre o Marca Texto. O app fica na bandeja do Windows, ao lado do relogio.
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" .
