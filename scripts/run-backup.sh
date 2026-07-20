#!/bin/zsh
# AerialDeck nightly backup — launched by launchd (ie.aerial.aerialdeck.backup).
#
# Runs whether or not the Claude app (or any app) is open. This exists because the
# original Claude scheduled task only fired while the app was running, so backups
# silently stopped for 5 days in July 2026 when the app was closed overnight.
#
# THIS FILE IS THE SOURCE OF TRUTH, but launchd executes the copy at
#   ~/Library/Application Support/AerialDeck/run-backup.sh
# because macOS TCC prevents a launchd job from READING a script inside ~/Documents
# (it fails with exit 127, "can't open input file"). After editing this file run:
#   ./scripts/install-backup-agent.sh
#
# Logs to backups/backup.log. Keeps the newest KEEP_DAYS full backups.

set -u
KEEP_DAYS=14
PROJECT="/Users/roc/Documents/AERIAL/AerialDeck"
NODE="/opt/homebrew/bin/node"
LOG="$PROJECT/backups/backup.log"

mkdir -p "$PROJECT/backups"
echo "" >> "$LOG"
echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') — backup starting =====" >> "$LOG"

cd "$PROJECT" || { echo "cannot cd to $PROJECT" >> "$LOG"; exit 1; }

if [ ! -f "$NODE" ]; then
  echo "FAIL: node not found at $NODE" >> "$LOG"
  exit 1
fi
if [ ! -f "$PROJECT/.env" ]; then
  echo "FAIL: .env missing — run: npx vercel env pull .env" >> "$LOG"
  exit 1
fi

"$NODE" backup-full.js >> "$LOG" 2>&1
STATUS=$?

if [ $STATUS -eq 0 ]; then
  "$NODE" backup-full.js --verify >> "$LOG" 2>&1
  VSTATUS=$?
  if [ $VSTATUS -ne 0 ]; then
    echo "WARNING: backup completed but VERIFY FAILED" >> "$LOG"
    STATUS=$VSTATUS
  fi
else
  echo "FAIL: backup exited $STATUS" >> "$LOG"
fi

# Prune old backups, keeping the newest KEEP_DAYS. Each is ~760MB.
cd "$PROJECT/backups" || exit $STATUS
COUNT=$(ls -d full-* 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -gt "$KEEP_DAYS" ]; then
  ls -d full-* | sort | head -n $((COUNT - KEEP_DAYS)) | while read -r old; do
    echo "pruning old backup: $old" >> "$LOG"
    rm -rf "$old"
  done
fi

echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') — finished, status $STATUS =====" >> "$LOG"
exit $STATUS
