#!/bin/bash
# Integrated Allergy Testing — Kiosk Launcher (Mac)
# Run this script to launch kiosk mode on Mac
# Chrome --kiosk flag removes all browser controls

echo "Launching Integrated Allergy Testing Kiosk..."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" \
  --kiosk \
  --incognito \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=TranslateUI \
  --no-first-run \
  --disable-default-apps \
  --disable-extensions \
  "https://integrated-allergy-testing.vercel.app/kiosk"
