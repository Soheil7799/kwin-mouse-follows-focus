// Mouse Follows Focus
//
// Goal: warp the pointer to the focused window ONLY for the two things the user wants —
//   (1) keyboard window navigation, and (2) a new application opening — and never for
//   mouse-driven focus changes (clicking a window, clicking/scrolling the panel/pager,
//   closing a window with the mouse, etc.).
//
// KWin's windowActivated signal can't say what caused a focus change, so we infer it:
//   * NEW window  -> windowAdded fires. Always warp (debounced + tracked so the cursor
//                    lands after the tiler/Krohnkite places it).
//   * NAVIGATION  -> windowActivated for an already-known window, but only warp if the
//                    POINTER HAS BEEN STILL. Keyboard nav moves focus without touching the
//                    mouse; clicking/closing with the mouse moves the pointer first.
//
// Extra hard guards that always apply: never warp if the pointer is already inside the
// focused window, or if it is over a panel/dock (covers wheel-scrolling the pager, which
// changes desktop without moving the pointer).
//
// Safe under Click-to-Focus: warping the pointer does not re-activate a window -> no loop.

// ---- tunables ----
var DEBOUNCE_MS = 90;     // collapse a new-window's activate/add/placement burst
var TRACK_MS = 1500;      // follow a new window's geometry this long after it opens
var POLL_MS = 70;         // pointer-movement sampling
var MOVE_GRACE_MS = 200;  // focus change within this of a real pointer move = mouse-driven
var WARP_SETTLE_MS = 400; // ignore pointer moves caused by our own warp

function now() { return Date.now(); }

function warpAction() {
    callDBus("org.kde.kglobalaccel", "/component/kwin",
             "org.kde.kglobalaccel.Component", "invokeShortcut", "MoveMouseToFocus");
}

// ---- pointer-movement tracking (keyboard vs mouse discriminator) ----
var lastPos = workspace.cursorPos;
var lastUserMoveMs = 0;
var lastWarpMs = -100000;

var pollTimer = new QTimer();
pollTimer.interval = POLL_MS;
pollTimer.singleShot = false;
pollTimer.timeout.connect(function () {
    var p = workspace.cursorPos;
    if (p.x !== lastPos.x || p.y !== lastPos.y) {
        // A move right after our own warp is the warp, not the user.
        if (now() - lastWarpMs > WARP_SETTLE_MS) {
            lastUserMoveMs = now();
        }
        lastPos = p;
    }
});
pollTimer.start();

function pointerMovedRecently() {
    return (now() - lastUserMoveMs) < MOVE_GRACE_MS;
}

// ---- geometry helpers ----
function cursorInside(window) {
    if (!window) {
        return false;
    }
    var c = workspace.cursorPos;
    var g = window.frameGeometry;
    return c.x >= g.x && c.x < g.x + g.width &&
           c.y >= g.y && c.y < g.y + g.height;
}

function cursorOverDock() {
    var c = workspace.cursorPos;
    var list = workspace.windowList();
    for (var i = 0; i < list.length; i++) {
        var win = list[i];
        if (!win.dock) {
            continue;
        }
        var g = win.frameGeometry;
        if (c.x >= g.x && c.x < g.x + g.width &&
            c.y >= g.y && c.y < g.y + g.height) {
            return true;
        }
    }
    return false;
}

// forced = new-window warp (bypasses the keyboard-only check; a new app should follow
// even if it was launched by clicking). Hard guards still apply.
function doWarp(forced) {
    var w = workspace.activeWindow;
    if (!w || cursorInside(w) || cursorOverDock()) {
        return;
    }
    if (!forced && pointerMovedRecently()) {
        return; // mouse-driven focus change -> not keyboard navigation
    }
    warpAction();
    lastWarpMs = now();
}

// ---- new-window debounce + placement tracking ----
var warpTimer = new QTimer();
warpTimer.interval = DEBOUNCE_MS;
warpTimer.singleShot = true;
warpTimer.timeout.connect(function () { doWarp(true); });

var tracked = null;
var trackTimer = new QTimer();
trackTimer.interval = TRACK_MS;
trackTimer.singleShot = true;
trackTimer.timeout.connect(stopTracking);

function stopTracking() {
    if (tracked) {
        try { tracked.frameGeometryChanged.disconnect(scheduleNewWarp); } catch (e) {}
        tracked = null;
    }
    trackTimer.stop();
}

function scheduleNewWarp() {
    warpTimer.stop();
    warpTimer.start();
}

function followNew(window) {
    stopTracking();
    scheduleNewWarp();
    tracked = window;
    try { window.frameGeometryChanged.connect(scheduleNewWarp); } catch (e) {}
    trackTimer.start();
}

// ---- known-window bookkeeping (so windowActivated handles only navigation) ----
var seen = {};
function keyOf(window) {
    try { return String(window.internalId); } catch (e) { return null; }
}
(function seedKnown() {
    var list = workspace.windowList();
    for (var i = 0; i < list.length; i++) {
        var k = keyOf(list[i]);
        if (k) seen[k] = true;
    }
})();

workspace.windowActivated.connect(function (window) {
    if (!window) {
        return;
    }
    var k = keyOf(window);
    if (k && seen[k]) {
        doWarp(false); // navigation: warp only if the pointer has been still (keyboard)
    } else if (k) {
        seen[k] = true; // first sight -> let windowAdded handle it as a new window
    }
});

workspace.windowAdded.connect(function (window) {
    if (!window) {
        return;
    }
    var k = keyOf(window);
    if (k) seen[k] = true;
    if (window.active) {
        followNew(window); // new application opening -> always follow (forced)
    }
});

workspace.windowRemoved.connect(function (window) {
    var k = keyOf(window);
    if (k) delete seen[k];
    if (window === tracked) stopTracking();
});
