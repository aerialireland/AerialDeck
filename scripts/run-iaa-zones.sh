#!/bin/zsh
# Daily IAA zone check, run by launchd (ie.aerial.aerialdeck.iaazones).
#
# This file is the source of truth, but launchd does NOT execute it from here:
# macOS TCC blocks a launchd job from reading a script inside ~/Documents, which
# fails with exit 127 and "can't open input file". install-iaa-zones-agent.sh
# copies it to ~/Library/Application Support/AerialDeck/ and runs that copy —
# the same arrangement as run-backup.sh.
#
# Checks the IAA for a new UAS Geographical Zones release, archives it to
# Supabase, and drops a copy into the Google Drive folder if Drive for Desktop
# is installed (auto-detected).

set -u

REPO="$HOME/Documents/AERIAL/AerialDeck"
cd "$REPO" || { echo "repo not found at $REPO"; exit 1; }

# launchd gets a minimal PATH; node lives in the Homebrew prefix.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

echo "----- $(date '+%Y-%m-%d %H:%M:%S') IAA zone check -----"
node scripts/fetch-iaa-zones.js
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "IAA zone check FAILED with exit $STATUS"
fi

exit $STATUS
