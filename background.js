const MARVEL_RIVALS_ID   = 24890;
const REGISTER_FEATURES  = ['match_info', 'game_info', 'gep_internal'];
const POLL_INTERVAL_MS   = 1000;   // How often getInfo is called (ms)
const REGISTER_RETRY_MS  = 2000;   // Retry delay if setRequiredFeatures fails (ms)
const REGISTER_MAX_TRIES = 10;     // Give up after this many attempts
const OVERLAY_WINDOW_NAME = "overlay";

// ─── State ────────────────────────────────────────────────────────────────────
let pollInterval        = null;
let prevPlayerStatsStr  = null;
let prevMatchState      = null;
let prevScene           = null;
let prevMatchId         = null;
let prevMatchOutcome    = null;
let inMatch             = false;
let registerAttempts    = 0;
let isAltPressed        = false;

// ─── Time Adjustment & Fallback State ─────────────────────────────────────────
let matchStartTimeout   = null;
let lastStatChangeTime  = null;
let statsIdleAlerted    = false;

// ─── Overlay Window Helpers ───────────────────────────────────────────────────
function openOverlayWindow() {
  console.log('[Overlay] Opening overlay...');
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (result.status === 'success') {
      overwolf.windows.restore(result.window.id, () => {
        console.log(`[Overlay] Restored — id=${result.window.id}`);
      });
    } else {
      console.error('[Overlay] obtainDeclaredWindow failed:', result);
    }
  });
}

function closeOverlayWindow() {
  console.log('[Overlay] Closing overlay...');
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (result.status === 'success') {
      overwolf.windows.close(result.window.id);
    } else {
      console.error('[Overlay] obtainDeclaredWindow (close) failed:', result);
    }
  });
}

function toggleEditWindowViaReact() {
    overwolf.windows.sendMessage(OVERLAY_WINDOW_NAME, "toggle_edit", null, (result) => {
        if (result.status !== "success") {
            console.error("Failed to send message to React window. Is it open?", result);
        }
    });
}

function setVisibilityViaReact(visible) {
    const messageId = visible ? "show_overlay" : "hide_overlay";
    overwolf.windows.sendMessage(OVERLAY_WINDOW_NAME, messageId, null, (result) => {
        if (result.status !== "success") {
            console.error(`Failed to send ${messageId} message to React window. Is it open?`, result);
        }
    });
}

// ─── Messaging Helper ─────────────────────────────────────────────────────────
function sendToOverlay(messageId, data) {
  overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
    if (res.status === 'success') {
      overwolf.windows.sendMessage(res.window.id, messageId, data, () => {});
    } else {
      console.error(`[Msg] Failed to obtain overlay for messageId='${messageId}':`, res);
    }
  });
}

// ─── Core Poll Function ───────────────────────────────────────────────────────
function pollGameInfo() {
  overwolf.games.events.getInfo((result) => {
    if (!result || result.status !== 'success' || !result.res) {
      console.warn('[Poll] getInfo returned no valid data:', result);
      return;
    }

    const { game_info, match_info } = result.res;

    // ── Scene (Lobby / Ingame) ────────────────────────────────────────────────
    if (game_info && game_info.scene && game_info.scene !== prevScene) {
      console.log(`[Poll] Scene: ${prevScene} → ${game_info.scene}`);
      prevScene = game_info.scene;
      sendToOverlay('scene_update', game_info.scene);
      
      if (game_info.scene === 'Lobby') {
        clearTimeout(matchStartTimeout);
        prevMatchId        = null;
        prevPlayerStatsStr = null;
        prevMatchState     = null;
        prevMatchOutcome   = null;
        inMatch            = false;
        lastStatChangeTime = null;
        sendToOverlay('match_event', 'match_end');
        setVisibilityViaReact(false); 
      } else if (game_info.scene === 'Ingame') {
        // Clear stats when entering a match scene (in case match_id doesn't update immediately)
        prevPlayerStatsStr = null;
        sendToOverlay('stats_update', { total_heal: 0, damage_dealt: 0, damage_block: 0, accuracy: 0 });
        setVisibilityViaReact(true); 
      }
    }

    // ── Match Lifecycle — driven by match_id appearing / disappearing ─────────
    const currentMatchId = (match_info && match_info.match_id) ? match_info.match_id : null;

    if (currentMatchId !== prevMatchId) {
      if (currentMatchId && !prevMatchId) {
        console.log('[Poll] match_id detected. Delaying match_start event by 135s...');
        inMatch            = true;
        prevPlayerStatsStr = null;
        prevMatchState     = null;
        prevMatchOutcome   = null;
        
        clearTimeout(matchStartTimeout);
        matchStartTimeout = setTimeout(() => {
            if (inMatch) { 
                console.log('[Poll] 135s wait over. Firing match_start.');
                sendToOverlay('match_event', 'match_start');
                lastStatChangeTime = Date.now(); 
                statsIdleAlerted = false;
            }
        }, 135000);

      } else if (!currentMatchId && prevMatchId) {
        // match_id cleared → match over
        console.log('[Poll] match_end — match_id gone');
        clearTimeout(matchStartTimeout);
        inMatch = false;
        lastStatChangeTime = null;
        sendToOverlay('match_event', 'match_end');

      } else if (currentMatchId && prevMatchId) {
        // match_id swapped without clearing (back-to-back matches)
        console.log('[Poll] Match ID rotated:', prevMatchId, '→', currentMatchId);
        clearTimeout(matchStartTimeout);
        sendToOverlay('match_event', 'match_end');
        
        inMatch            = true;
        prevPlayerStatsStr = null;
        prevMatchState     = null;
        prevMatchOutcome   = null;
        
        matchStartTimeout = setTimeout(() => {
            if (inMatch) {
                console.log('[Poll] 135s wait over for swapped match. Firing match_start.');
                sendToOverlay('match_event', 'match_start');
                lastStatChangeTime = Date.now();
                statsIdleAlerted = false;
            }
        }, 135000);
      }

      prevMatchId = currentMatchId;
    }

    // Nothing else to check if match_info isn't present
    if (!match_info) return;

    // ── Player Stats & Fallback Idle Check ────────────────────────────────────
    const rawStats = match_info.player_stats;
    if (rawStats !== undefined && rawStats !== null) {
      const statsStr = typeof rawStats === 'string' ? rawStats : JSON.stringify(rawStats);

      // Compare stringified stats to detect changes (except accuracy which may fluctuate slightly)
      // Remove accuracy from comparison to avoid false positives due to minor fluctuations
      const statsStrForComparison = statsStr.replace(/"accuracy":\s*[\d.]+,?/, '');
      const prevStatsStrForComparison = prevPlayerStatsStr ? prevPlayerStatsStr.replace(/"accuracy":\s*[\d.]+,?/, '') : null;

      console.log("[Poll] Current stats string for comparison:", statsStrForComparison);

      if (statsStrForComparison !== prevStatsStrForComparison) {
        prevPlayerStatsStr = statsStr;
        lastStatChangeTime = Date.now(); 
        statsIdleAlerted = false; 

        try {
          const stats = typeof rawStats === 'string' ? JSON.parse(rawStats) : rawStats;
          console.log('[Poll] player_stats updated:', stats);
          sendToOverlay('stats_update', stats);
        } catch (e) {
          console.error('[Poll] Failed to parse player_stats:', e);
        }
      } else if (inMatch && lastStatChangeTime) {
        // FALLBACK: If API events fail and stats stay still for 120s, adjust time
        const timeSinceLastStatUpdate = Date.now() - lastStatChangeTime;
        
        if (timeSinceLastStatUpdate >= 120000 && !statsIdleAlerted) {
            console.log('[Fallback] Stats idle for 120s without API event trigger. Adjusting time.');
            sendToOverlay('time_adjustment', { deduct_ms: 120000 });
            statsIdleAlerted = true; 
        }
      }
    }

    // ── Match State ───────────────────────────────────────────────────────────
    if (match_info.match_state !== undefined && match_info.match_state !== prevMatchState) {
      prevMatchState = match_info.match_state;
      console.log('[Poll] match_state updated:', match_info.match_state);
      sendToOverlay('match_state_update', match_info.match_state);
    }

    // ── Match Outcome ─────────────────────────────────────────────────────────
    if (match_info.match_outcome && match_info.match_outcome !== prevMatchOutcome) {
      prevMatchOutcome = match_info.match_outcome;
      console.log('[Poll] match_outcome:', match_info.match_outcome);
      sendToOverlay('match_outcome', match_info.match_outcome);
    }
  });
}

// ─── Polling Control ──────────────────────────────────────────────────────────
function startPolling() {
  if (pollInterval) return;
  console.log(`[Poll] Starting — interval ${POLL_INTERVAL_MS}ms`);
  pollGameInfo(); 
  pollInterval = setInterval(pollGameInfo, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (!pollInterval) return;
  clearInterval(pollInterval);
  pollInterval = null;

  clearTimeout(matchStartTimeout);
  prevPlayerStatsStr = null;
  prevMatchState     = null;
  prevScene          = null;
  prevMatchId        = null;
  prevMatchOutcome   = null;
  inMatch            = false;
  registerAttempts   = 0;
  lastStatChangeTime = null;

  console.log('[Poll] Stopped — state reset.');
}

// ─── Feature Registration ─────────────────────────────────────────────────────
function registerFeatures() {
  if (registerAttempts >= REGISTER_MAX_TRIES) {
    console.error(`[GEP] Giving up after ${REGISTER_MAX_TRIES} registration attempts.`);
    return;
  }

  registerAttempts++;
  console.log(`[GEP] Registering features (attempt ${registerAttempts}):`, REGISTER_FEATURES);

  overwolf.games.events.setRequiredFeatures(REGISTER_FEATURES, (result) => {
    if (result.status === 'success' || result.success) {
      console.log('[GEP] Registration succeeded. Supported features:', result.supportedFeatures);
      registerAttempts = 0;
      startPolling();
    } else {
      console.warn(`[GEP] Registration failed (attempt ${registerAttempts}), retrying in ${REGISTER_RETRY_MS}ms:`, result);
      setTimeout(registerFeatures, REGISTER_RETRY_MS);
    }
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
console.log('[App] Checking for running game on startup...');
overwolf.games.getRunningGameInfo((gameInfo) => {
  console.log('[App] getRunningGameInfo result:', gameInfo);
  if (gameInfo && gameInfo.isRunning && gameInfo.classId === MARVEL_RIVALS_ID) {
    console.log(`[App] Marvel Rivals already running — opening overlay & registering features.`);
    openOverlayWindow();
    registerFeatures();
  } else {
    console.log('[App] Marvel Rivals not currently running.');
  }
});

console.log('[App] Registering onGameInfoUpdated listener...');
overwolf.games.onGameInfoUpdated.addListener((event) => {
  if (!event || !event.runningChanged || !event.gameInfo) return;
  if (event.gameInfo.classId !== MARVEL_RIVALS_ID) return;

  if (event.gameInfo.isRunning) {
    console.log('[App] Marvel Rivals launched — opening overlay & registering features.');
    openOverlayWindow();
    registerFeatures();
  } else {
    console.log('[App] Marvel Rivals exited — closing overlay & stopping polling.');
    closeOverlayWindow();
    stopPolling();
  }
});

// ─── Hotkeys ──────────────────────────────────────────────────────────────────
overwolf.games.inputTracking.onKeyDown.addListener((info) => {
    if (info.key === "163" || info.key === "164" || info.key === "165") {
        isAltPressed = true;
    }
    if ((info.key === "56" || info.key === "104") && isAltPressed && info.onGame) {
        toggleEditWindowViaReact(); 
    }
});

overwolf.games.inputTracking.onKeyUp.addListener((info) => {
    if (info.key === "163" || info.key === "164" || info.key === "165") {
        isAltPressed = false;
    }
});

// ─── Real-Time Game Events (Primary Method) ───────────────────────────────────
console.log('[App] Registering onNewEvents listener...');
overwolf.games.events.onNewEvents.addListener((info) => {
  if (!info || !info.events || info.events.length === 0) return;

  info.events.forEach((event) => {
    switch (event.name) {
      case 'round_start':
        console.log('[GEP Event] round_start detected natively! Resetting fallback timers.');
        // Primary Choice Action: Send event to React immediately
        sendToOverlay('match_event', 'round_start'); 
        
        // Reset our fallback logic tracking because the API successfully told us the round started
        lastStatChangeTime = Date.now();
        statsIdleAlerted = false;
        break;
      
      case 'round_end':
        console.log('[GEP Event] round_end detected natively! Sending adjustment.');
        // Primary Choice Action: Send event to React immediately
        sendToOverlay('match_event', 'round_end');
        
        // Since the round ended natively, adjust time or stop fallback timers until next round starts
        sendToOverlay('time_adjustment', { deduct_ms: 135000 });
        statsIdleAlerted = true; // Block fallback from double firing
        break;

      default:
        break;
    }
  });
});
