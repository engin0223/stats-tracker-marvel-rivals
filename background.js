const MARVEL_RIVALS_ID = 24890;
const REGISTER_FEATURES = ['match_info', 'game_info', 'gep_internal'];

function openOverlayWindow() {
  console.log('[Overlay] Requesting overlay window open...');
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (result.status === 'success') {
      console.log(`[Overlay] Restoring window id=${result.window.id}`);
      overwolf.windows.restore(result.window.id, () => {
        console.log(`[Overlay] Window restored id=${result.window.id}`);
      });
    } else {
      console.error('[Overlay] obtainDeclaredWindow failed:', result);
    }
  });
}

function closeOverlayWindow() {
  console.log('[Overlay] Requesting overlay window close...');
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (result.status === 'success') {
      console.log(`[Overlay] Closing window id=${result.window.id}`);
      overwolf.windows.close(result.window.id);
    } else {
      console.error('[Overlay] obtainDeclaredWindow (close) failed:', result);
    }
  });
}

// --- 1. Define and Setup Listeners Globally ---
let listenersRegistered = false;

function setupEventListeners() {
  if (listenersRegistered) return;
  
  console.log('[GEP] Setting up onInfoUpdates2 and onNewEvents listeners...');

  // Listen for Info Updates
  overwolf.games.events.onInfoUpdates2.addListener((info) => {
    console.log('[GEP] onInfoUpdates2 fired. feature=' + info.feature, info);

    // Grab player_stats whether they arrive under match_info or standalone stats
    let rawStats = null;
    
    if (info.feature === "match_info" && info.info.match_info && info.info.match_info.player_stats) {
        rawStats = info.info.match_info.player_stats;
    } else if (info.feature === "stats" && info.info.stats) {
        rawStats = info.info.stats;
    } else if (info.info.game_info && info.info.game_info.player_stats) {
        rawStats = info.info.game_info.player_stats;
    }

    // If we found stats in this update, parse and forward them
    if (rawStats !== null && rawStats !== undefined) {
      console.log('[GEP] player_stats live update received:', rawStats);
      try {
        const stats = typeof rawStats === 'string' ? JSON.parse(rawStats) : rawStats;
        overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
          if (res.status === 'success') {
            overwolf.windows.sendMessage(res.window.id, 'stats_update', stats, () => {});
          }
        });
      } catch (e) {
        console.error('[GEP] Failed to parse live player_stats:', e);
      }
    }

    // Forward Match State (Separated from stats)
    if (info.feature === "match_info" && info.info.match_info && info.info.match_info.match_state) {
      console.log('[GEP] match_state live update received:', info.info.match_info.match_state);
      overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
        if (res.status === 'success') {
          overwolf.windows.sendMessage(res.window.id, 'match_state_update', info.info.match_info.match_state, () => {});
        }
      });
    }
  });

  // Listen for Triggered Events
  overwolf.games.events.onNewEvents.addListener((info) => {
    console.log('[GEP] onNewEvents fired:', info.events);
    const matchEvents = info.events.filter(e => e.name === 'match_start' || e.name === 'match_end');
    console.log('[GEP] Relevant match events:', matchEvents);
    
    matchEvents.forEach(event => {
      console.log(`[GEP] Handling match event: ${event.name}`);
      overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
        if (res.status === 'success') {
          console.log(`[GEP] Sending match_event '${event.name}' to overlay window id=${res.window.id}`);
          overwolf.windows.sendMessage(res.window.id, 'match_event', event.name, () => {
            console.log(`[GEP] match_event '${event.name}' message sent.`);
          });
        } else {
          console.error(`[GEP] obtainDeclaredWindow (match_event '${event.name}') failed:`, res);
        }
      });
    });
  });

  listenersRegistered = true;
  console.log('[GEP] Listeners registered.');
}

// --- 2. Register Features ---
function registerFeatures() {
  console.log('[GEP] Registering features:', REGISTER_FEATURES);
  overwolf.games.events.setRequiredFeatures(REGISTER_FEATURES, (result) => {
    if (result.status === 'success' || result.success) {
      console.log('[GEP] Registration succeeded. Supported features:', result.supportedFeatures);

      setupEventListeners();

      // Fetch immediate info in case app started mid-match
      console.log('[GEP] Fetching current game info (mid-match check)...');
      overwolf.games.events.getInfo((info) => {
        console.log('[GEP] getInfo response:', info);
        if (info && info.res && info.res.match_info) {
          const matchInfo = info.res.match_info;
          console.log('[GEP] Mid-match state detected. match_info:', matchInfo);

          overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
            if (res.status === 'success') {
              // Send current match state
              if (matchInfo.match_state) {
                console.log('[GEP] Sending initial match_state to overlay:', matchInfo.match_state);
                overwolf.windows.sendMessage(res.window.id, 'match_state_update', matchInfo.match_state, () => {
                  console.log('[GEP] match_state_update message sent.');
                });
              } else {
                console.log('[GEP] No match_state in current info, skipping.');
              }
              // Send current player stats
              if (matchInfo.player_stats != null) {
                console.log('[GEP] Sending initial player_stats to overlay (raw):', matchInfo.player_stats);
                try {
                  const statsStr = matchInfo.player_stats;
                  const stats = typeof statsStr === 'string' ? JSON.parse(statsStr) : statsStr;
                  console.log('[GEP] Parsed initial player_stats:', stats);
                  overwolf.windows.sendMessage(res.window.id, 'stats_update', stats, () => {
                    console.log('[GEP] stats_update message sent.');
                  });
                } catch(e) {
                  console.error('[GEP] Failed to parse initial player_stats:', e, matchInfo.player_stats);
                }
              } else {
                console.log('[GEP] No player_stats in current info, skipping.');
              }
            } else {
              console.error('[GEP] obtainDeclaredWindow (mid-match) failed:', res);
            }
          });
        } else {
          console.log('[GEP] No mid-match data found (app started outside a match).');
        }
      });
    } else {
      console.warn('[GEP] Registration failed (game pipeline may still be loading), retrying in 2s...', result);
      setTimeout(registerFeatures, 2000);
    }
  });
}

// --- 3. App Lifecycle Hooks ---
console.log('[App] Checking for running game on startup...');
overwolf.games.getRunningGameInfo((gameInfo) => {
  console.log('[App] getRunningGameInfo result:', gameInfo);
  if (gameInfo && gameInfo.isRunning && gameInfo.classId === MARVEL_RIVALS_ID) {
    console.log(`[App] Marvel Rivals already running (classId=${gameInfo.classId}). Opening overlay and registering features.`);
    openOverlayWindow();
    registerFeatures();
  } else {
    console.log('[App] Marvel Rivals not currently running.', gameInfo);
  }
});

console.log('[App] Registering onGameInfoUpdated listener...');
overwolf.games.onGameInfoUpdated.addListener((event) => {
  console.log('[App] onGameInfoUpdated fired:', event);
  if (event && event.runningChanged && event.gameInfo) {
    console.log(`[App] Running state changed. classId=${event.gameInfo.classId}, isRunning=${event.gameInfo.isRunning}`);
    if (event.gameInfo.classId === MARVEL_RIVALS_ID) {
      if (event.gameInfo.isRunning) {
        console.log('[App] Marvel Rivals launched. Opening overlay and registering features.');
        openOverlayWindow();
        registerFeatures();
      } else {
        console.log('[App] Marvel Rivals exited. Closing overlay.');
        closeOverlayWindow();
      }
    } else {
      console.log(`[App] Ignored game update for classId=${event.gameInfo.classId} (not Marvel Rivals).`);
    }
  } else {
    console.log('[App] onGameInfoUpdated: no running state change, skipping.');
  }
});
