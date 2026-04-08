@echo off
:: Integrated Allergy Testing — Kiosk Launcher
:: Double-click this file on the clinic tablet to launch kiosk mode
:: Chrome --kiosk flag: removes title bar, X button, address bar, all controls
:: Esc key does NOT exit in --kiosk mode

echo Launching Integrated Allergy Testing Kiosk...

:: Try standard Chrome install location
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

:: Launch in true kiosk mode
start "" %CHROME% ^
  --kiosk ^
  --incognito ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --disable-features=TranslateUI ^
  --no-first-run ^
  --disable-default-apps ^
  --disable-extensions ^
  https://integrated-allergy-testing.vercel.app/kiosk

echo Kiosk launched. Press any key to exit this window.
