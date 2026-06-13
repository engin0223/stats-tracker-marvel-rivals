const MARVEL_RIVALS_ID   = 24890;
const REGISTER_FEATURES  = ['match_info', 'game_info', 'gep_internal'];
const POLL_INTERVAL_MS   = 1000;   // How often getInfo is called (ms)
const REGISTER_RETRY_MS  = 2000;   // Retry delay if setRequiredFeatures fails (ms)
const REGISTER_MAX_TRIES = 10;     // Give up after this many attempts

// ─── State ────────────────────────────────────────────────────────────────────
let pollInterval        = null;
let prevPlayerStatsStr  = null;
let prevMatchState      = null;
let prevScene           = null;
let prevMatchId         = null;
let prevMatchOutcome    = null;
let inMatch             = false;
let registerAttempts    = 0;

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
        // Reset match-related state when returning to lobby
        prevMatchId        = null;
        prevPlayerStatsStr = null;
        prevMatchState     = null;
        prevMatchOutcome   = null;
        inMatch            = false;
        sendToOverlay('match_event', 'match_end');
      } else if (game_info.scene === 'Ingame') {
        // Clear stats when entering a match scene (in case match_id doesn't update immediately)
        prevPlayerStatsStr = null;
        sendToOverlay('stats_update', { total_heal: 0, damage_dealt: 0, damage_block: 0, accuracy: 0 });
        sendToOverlay('match_event', 'match_start');
      }
    }

    // ── Match Lifecycle — driven by match_id appearing / disappearing ─────────
    const currentMatchId = (match_info && match_info.match_id) ? match_info.match_id : null;

    if (currentMatchId !== prevMatchId) {
      if (currentMatchId && !prevMatchId) {
        // Fresh match started
        console.log('[Poll] match_start — match_id:', currentMatchId);
        inMatch            = true;
        prevPlayerStatsStr = null;
        prevMatchState     = null;
        prevMatchOutcome   = null;
        sendToOverlay('match_event', 'match_start');

      } else if (!currentMatchId && prevMatchId) {
        // match_id cleared → match over
        console.log('[Poll] match_end — match_id gone');
        inMatch = false;
        sendToOverlay('match_event', 'match_end');

      } else if (currentMatchId && prevMatchId) {
        // match_id swapped without clearing (back-to-back matches)
        console.log('[Poll] Match ID rotated:', prevMatchId, '→', currentMatchId);
        sendToOverlay('match_event', 'match_end');
        inMatch            = true;
        prevPlayerStatsStr = null;
        prevMatchState     = null;
        prevMatchOutcome   = null;
        sendToOverlay('match_event', 'match_start');
      }

      prevMatchId = currentMatchId;
    }

    // Nothing else to check if match_info isn't present
    if (!match_info) return;

    // ── Player Stats ──────────────────────────────────────────────────────────
    const rawStats = match_info.player_stats;
    if (rawStats !== undefined && rawStats !== null) {
      const statsStr = typeof rawStats === 'string' ? rawStats : JSON.stringify(rawStats);

      if (statsStr !== prevPlayerStatsStr) {
        prevPlayerStatsStr = statsStr;
        try {
          const stats = typeof rawStats === 'string' ? JSON.parse(rawStats) : rawStats;
          console.log('[Poll] player_stats updated:', stats);
          sendToOverlay('stats_update', stats);
        } catch (e) {
          console.error('[Poll] Failed to parse player_stats:', e);
        }
      }
    }

    // ── Match State ───────────────────────────────────────────────────────────
    if (match_info.match_state !== undefined && match_info.match_state !== prevMatchState) {
      prevMatchState = match_info.match_state;
      console.log('[Poll] match_state updated:', match_info.match_state);
      sendToOverlay('match_state_update', match_info.match_state);
    }

    // ── Match Outcome (Victory / Defeat / Draw) ───────────────────────────────
    if (match_info.match_outcome && match_info.match_outcome !== prevMatchOutcome) {
      prevMatchOutcome = match_info.match_outcome;
      console.log('[Poll] match_outcome:', match_info.match_outcome);
      sendToOverlay('match_outcome', match_info.match_outcome);
    }
  });
}

// ─── Polling Control ──────────────────────────────────────────────────────────
function startPolling() {
  if (pollInterval) {
    console.log('[Poll] Already running, skipping start.');
    return;
  }
  console.log(`[Poll] Starting — interval ${POLL_INTERVAL_MS}ms`);
  pollGameInfo();                                           // Immediate first call
  pollInterval = setInterval(pollGameInfo, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (!pollInterval) return;
  clearInterval(pollInterval);
  pollInterval = null;

  // Reset all tracked state so a fresh game session starts clean
  prevPlayerStatsStr = null;
  prevMatchState     = null;
  prevScene          = null;
  prevMatchId        = null;
  prevMatchOutcome   = null;
  inMatch            = false;
  registerAttempts   = 0;

  console.log('[Poll] Stopped — state reset.');
}

// ─── Feature Registration (with auto-retry) ───────────────────────────────────
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
  console.log('[App] onGameInfoUpdated fired:', event);

  if (!event || !event.runningChanged || !event.gameInfo) {
    console.log('[App] No running-state change — skipping.');
    return;
  }

  if (event.gameInfo.classId !== MARVEL_RIVALS_ID) {
    console.log(`[App] Ignored — classId ${event.gameInfo.classId} is not Marvel Rivals.`);
    return;
  }

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
