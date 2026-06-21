#!/usr/bin/env bash
# Remove the Mouse Follows Focus KWin script.
set -e

NAME="mouse-follows-focus"
QDBUS="$(command -v qdbus6 || command -v qdbus || true)"

if [ -n "$QDBUS" ]; then
    "$QDBUS" org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "$NAME" >/dev/null 2>&1 || true
fi

kwriteconfig6 --file kwinrc --group Plugins --key "${NAME}Enabled" false
kpackagetool6 --type KWin/Script --remove "$NAME" 2>/dev/null || \
    rm -rf "$HOME/.local/share/kwin/scripts/$NAME"

[ -n "$QDBUS" ] && "$QDBUS" org.kde.KWin /KWin org.kde.KWin.reconfigure >/dev/null 2>&1 || true

echo "Removed $NAME."
