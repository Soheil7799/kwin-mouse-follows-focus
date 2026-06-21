# Mouse Follows Focus (KWin script)

A small KWin script for **KDE Plasma 6** that warps the mouse pointer to the focused
window — but *only* when you actually want it to: **keyboard window navigation** and
**newly opened applications**. It deliberately stays out of the way for mouse-driven
focus changes.

It's built for a **Click-to-Focus + multi-monitor** setup, where moving focus by keyboard
(tiling-script navigation, `Alt`+`Tab`, switching desktops) leaves the cursor stranded on
the other screen.

## Why another one?

Most "mouse follows focus" scripts warp on *every* focus change, which is maddening: the
cursor jumps when you click a window, when you scroll your pager, or when you close a
window with the mouse. KWin's `windowActivated` signal can't tell you *what* caused a
focus change, so this script infers it instead.

## What it does

| Action | Pointer warps? | Why |
| --- | --- | --- |
| Keyboard window navigation to a window elsewhere | **yes** | focus moved while the pointer was still |
| A new application opens (any launch method) | **yes** | follows the window after the tiler places it |
| Click an unfocused window | no | the pointer is already on it / it just moved |
| Click or scroll the panel / pager | no | the pointer is over a panel (dock) |
| Close a window with the mouse | no | the pointer moved just before focus changed |

## How it works

- **New windows** (`windowAdded`): always followed. The warp is debounced and re-armed on
  the window's `frameGeometryChanged`, so the cursor lands at the window's **final** spot
  even if a tiler (e.g. Krohnkite) repositions it after it opens.
- **Navigation** (`windowActivated` on an already-known window): warps **only if the
  pointer has been still** (no real mouse movement in the last ~200 ms). Keyboard nav moves
  focus without touching the mouse; clicking or closing with the mouse moves the pointer
  first. Pointer movement is sampled by polling `workspace.cursorPos`; the script's own
  warps are excluded so rapid keyboard navigation keeps following.
- **Hard guards** (always): never warp if the pointer is already inside the focused window,
  or if it's over a panel/dock.

Under the hood it triggers KWin's built-in **"Move Mouse to Focus"** action
(`MoveMouseToFocus`, the one you can also bind to a key like `Meta`+`F5`) via D-Bus, so the
actual pointer move uses KWin's own code path.

## Requirements

- KDE Plasma 6 / KWin 6 (`X-Plasma-API-Minimum-Version` is `6.0`)
- Tested on Plasma 6.7, Wayland

## Install

### From the GUI (no terminal)

1. Open **System Settings → Window Management → KWin Scripts**.
2. Click **Install from File…** and pick `mouse-follows-focus.kwinscript` (shipped in this
   repo).
3. Make sure **Mouse Follows Focus** is checked, then **Apply**.

### From the command line

```bash
./install.sh
```

This installs the package with `kpackagetool6`, enables it, and loads it into the running
KWin session. Or manually:

```bash
kpackagetool6 --type KWin/Script --install .
kwriteconfig6 --file kwinrc --group Plugins --key mouse-follows-focusEnabled true
# then toggle it in: System Settings -> Window Management -> KWin Scripts
```

> **Note on autoloading at boot:** the package metadata declares
> `"X-Plasma-API": "javascript"`. Without it KWin can install and run the script when loaded
> manually, but will *not* start it automatically after a reboot.

## Uninstall

```bash
./uninstall.sh
```

## Tuning

All knobs live at the top of [`contents/code/main.js`](contents/code/main.js):

| Constant | Default | Meaning |
| --- | --- | --- |
| `DEBOUNCE_MS` | 90 | collapse a new window's activate/add/placement burst into one warp |
| `TRACK_MS` | 1500 | how long to follow a new window's geometry after it opens |
| `POLL_MS` | 70 | pointer-movement sampling interval |
| `MOVE_GRACE_MS` | 200 | a focus change within this of a real pointer move counts as mouse-driven |
| `WARP_SETTLE_MS` | 400 | ignore pointer moves caused by the script's own warp |

After editing, reload without logging out:

```bash
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript mouse-follows-focus
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript \
  "$HOME/.local/share/kwin/scripts/mouse-follows-focus/contents/code/main.js" mouse-follows-focus
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.start
```

(`qdbus6` is `qdbus` on some distributions.)

## Known edge cases

- Closing or activating a window via the **keyboard** also warps (focus moved while the
  pointer was still, so it reads as navigation).
- If you deliberately move the mouse and then keyboard-navigate within ~200 ms, that one
  navigation won't warp. Lower `MOVE_GRACE_MS` if it bothers you.

## License

MIT — see [LICENSE](LICENSE).
