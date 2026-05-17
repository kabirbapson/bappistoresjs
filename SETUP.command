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

node scripts/install.mjs
status=$?

echo ""
if [ $status -eq 0 ]; then
  echo "  Next: double-click START.command to run the shop app."
else
  echo "  Setup failed. See messages above."
fi
echo ""
read -r -p "Press Enter to close..."
