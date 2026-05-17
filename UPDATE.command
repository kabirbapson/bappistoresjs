#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "This updates the app and keeps your sales records."
echo ""
read -p "Press Enter to continue..."
node scripts/update.mjs
read -p "Press Enter to close..."
