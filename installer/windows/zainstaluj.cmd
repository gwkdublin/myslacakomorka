@echo off
chcp 65001 >nul
rem Rejestruje dodatek Wykresy w PowerPoincie dla bieżącego użytkownika (bez uprawnień administratora).
set "DIR=%LOCALAPPDATA%\WykresyDodatek"
if not exist "%~dp0manifest.xml" (
  echo Nie znaleziono pliku manifest.xml obok instalatora. Rozpakuj całe archiwum i uruchom ponownie.
  goto koniec
)
tasklist /FI "IMAGENAME eq POWERPNT.EXE" 2>nul | find /I "POWERPNT.EXE" >nul && (
  echo Zamknij PowerPointa i uruchom instalator ponownie.
  goto koniec
)
if not exist "%DIR%" mkdir "%DIR%"
copy /Y "%~dp0manifest.xml" "%DIR%\manifest.xml" >nul || goto blad
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "40bc4e7a-b99a-46b3-bc29-459bad5e9fa2" /t REG_SZ /d "%DIR%\manifest.xml" /f >nul || goto blad
echo.
echo Gotowe. Uruchom PowerPointa - przycisk "Wykresy" jest na karcie Narzędzia główne.
goto koniec
:blad
echo.
echo Instalacja nie powiodła się. Skopiuj powyższy komunikat i prześlij go dalej.
:koniec
echo.
pause
