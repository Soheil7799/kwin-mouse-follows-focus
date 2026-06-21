#!/usr/bin/env bash
# Install / update the Mouse Follows Focus KWin script and load it into the running session.
set -e

NAME="mouse-follows-focus"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# qdbus is named qdbus6 on some distros, qdbus on others.
QDBUS="$(command -v qdbus6 || command -v qdbus || true)"

echo "Installing $NAME ..."
if kpackagetool6 --type KWin/Script --list 2>/dev/null | grep -qx "$NAME"; then
    kpackagetool6 --type KWin/Script --upgrade "$SCRIPT_DIR"
else
    kpackagetool6 --type KWin/Script --install "$SCRIPT_DIR"
fi

echo "Enabling in kwinrc ..."
kwriteconfig6 --file kwinrc --group Plugins --key "${NAME}Enabled" true

if [ -n "$QDBUS" ]; then
    echo "Loading into the running KWin session ..."
    "$QDBUS" org.kde.KWin /KWin org.kde.KWin.reconfigure >/dev/null 2>&1 || true
    JS="$HOME/.local/share/kwin/scripts/$NAME/contents/code/main.js"
    "$QDBUS" org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "$NAME" >/dev/null 2>&1 || true
    "$QDBUS" org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "$JS" "$NAME" >/dev/null 2>&1 || true
    "$QDBUS" org.kde.KWin /Scripting org.kde.kwin.Scripting.start >/dev/null 2>&1 || true
else
    echo "qdbus not found; log out/in (or restart KWin) to activate."
fi

echo "Done. Toggle it any time in System Settings -> Window Management -> KWin Scripts."
