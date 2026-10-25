@echo off
chcp 65001 >nul
rem Usuwa rejestrację dodatku Wykresy z PowerPointa.
reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "40bc4e7a-b99a-46b3-bc29-459bad5e9fa2" /f >nul 2>&1
if exist "%LOCALAPPDATA%\WykresyDodatek" rmdir /S /Q "%LOCALAPPDATA%\WykresyDodatek"
echo Dodatek Wykresy został usunięty. Zmiana będzie widoczna po ponownym uruchomieniu PowerPointa.
echo.
pause
