#!/bin/zsh
# Install/refresh the nightly backup launchd agent.
# Run after editing scripts/run-backup.sh.
#
#   ./scripts/install-backup-agent.sh
#
# Why the script gets copied out of the repo: macOS TCC blocks a launchd job from
# reading a script stored inside ~/Documents (exit 127, "can't open input file"),
# so the executed copy lives in ~/Library/Application Support/AerialDeck/.

set -e
PROJECT="/Users/roc/Documents/AERIAL/AerialDeck"
DEST="$HOME/Library/Application Support/AerialDeck"
PLIST="$HOME/Library/LaunchAgents/ie.aerial.aerialdeck.backup.plist"
LABEL="ie.aerial.aerialdeck.backup"

mkdir -p "$DEST"
cp "$PROJECT/scripts/run-backup.sh" "$DEST/run-backup.sh"
chmod +x "$DEST/run-backup.sh"
echo "installed script -> $DEST/run-backup.sh"

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
        <string>$DEST/run-backup.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key><integer>22</integer>
        <key>Minute</key><integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>$PROJECT/backups/launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT/backups/launchd.err.log</string>
    <key>WorkingDirectory</key>
    <string>$PROJECT</string>
    <key>RunAtLoad</key><false/>
</dict>
</plist>
PLISTEOF

plutil -lint "$PLIST"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "agent loaded. Verify with:  launchctl list | grep aerialdeck"
echo "Run now with:               launchctl start $LABEL"
echo "Uninstall with:             launchctl unload $PLIST && rm $PLIST"
