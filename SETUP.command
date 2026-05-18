#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js is not installed."
  echo "  Download LTS from https://nodejs.org"
  echo "  Then double-click SETUP.command again."
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

echo ""
echo "  Progress below (5-15 minutes). Do not close this window."
echo "  Log saved to setup-log.txt"
echo ""

node scripts/install.mjs
status=$?

echo ""
if [ $status -eq 0 ]; then
  echo "  Next: double-click START.command to run the shop app."
else
  echo "  Setup failed. See messages above and setup-log.txt"
fi
echo ""
read -r -p "Press Enter to close..."
