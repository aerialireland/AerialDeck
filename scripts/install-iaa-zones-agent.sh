#!/bin/zsh
# Installs (or reinstalls) the daily IAA zone check as a launchd agent.
#
# Mirrors install-backup-agent.sh: the executed copy of the script lives in
# ~/Library/Application Support/AerialDeck/ because macOS TCC blocks launchd
# from reading scripts inside ~/Documents.
#
#   ./scripts/install-iaa-zones-agent.sh
#
# Runs daily at 07:00. launchd runs a missed job when the Mac next wakes, so a
# machine that was off overnight still gets its check.

set -eu

LABEL="ie.aerial.aerialdeck.iaazones"
REPO="$HOME/Documents/AERIAL/AerialDeck"
EXEC_DIR="$HOME/Library/Application Support/AerialDeck"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$REPO/backups"

mkdir -p "$EXEC_DIR" "$LOG_DIR" "$HOME/Library/LaunchAgents"

cp "$REPO/scripts/run-iaa-zones.sh" "$EXEC_DIR/run-iaa-zones.sh"
chmod +x "$EXEC_DIR/run-iaa-zones.sh"
echo "copied runner to $EXEC_DIR/run-iaa-zones.sh"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>$EXEC_DIR/run-iaa-zones.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key><integer>7</integer>
        <key>Minute</key><integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/iaazones.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/iaazones.err.log</string>
    <key>WorkingDirectory</key>
    <string>$REPO</string>
    <key>RunAtLoad</key><false/>
</dict>
</plist>
PLISTEOF
echo "wrote $PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "loaded $LABEL"

echo ""
echo "Installed. Daily at 07:00."
echo "  run now : launchctl kickstart -k gui/$(id -u)/$LABEL"
echo "  logs    : $LOG_DIR/iaazones.out.log"
echo "  remove  : launchctl bootout gui/$(id -u)/$LABEL && rm $PLIST"
