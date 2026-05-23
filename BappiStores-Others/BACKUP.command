#!/bin/bash
cd "$(dirname "$0")"
node scripts/backup-data.mjs
read -p "Press Enter to close..."
