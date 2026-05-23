#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js from https://nodejs.org then run SETUP.command first."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -f ".setup-complete" ]; then
  echo ""
  echo "  Setup has not been run yet."
  echo "  Double-click SETUP.command first (one time only)."
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

echo ""
echo "  Bappi Stores is starting..."
echo "  Browser: http://bappistores:5001"
echo "  Login: admin@bappi.com  /  admin123"
echo ""
echo "  Leave this window open while using the app."
echo "  Press Ctrl+C to stop."
echo ""

(sleep 12 && open "http://bappistores:5001/" 2>/dev/null) &

node scripts/start-shop.mjs
