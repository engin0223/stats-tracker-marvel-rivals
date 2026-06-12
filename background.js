const MARVEL_RIVALS_ID = 24890;
const REGISTER_FEATURES = ['match_info', 'game_info'];

function openOverlayWindow() {
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (result.status === 'success') {
      overwolf.windows.restore(result.window.id, () => {});
    }
  });
}

function closeOverlayWindow() {
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (result.status === 'success') {
      overwolf.windows.close(result.window.id);
    }
  });
}

// 1. Register to the Game Events Provider (GEP) natively
function registerFeatures() {
  overwolf.games.events.setRequiredFeatures(REGISTER_FEATURES, (result) => {
    if (result.status === 'success' || result.success) {
      console.log("Successfully registered for Marvel Rivals GEP data.");
      
      // 1. Setup real-time listeners for future events
      setupEventListeners();

      // Fetch immediate info in case app started mid-match
      overwolf.games.events.getInfo((info) => {
        if (info && info.res && info.res.match_info) {
          const matchInfo = info.res.match_info;
          
          overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
            if (res.status === 'success') {
              // Send current match state
              if (matchInfo.match_state) {
                overwolf.windows.sendMessage(res.window.id, 'match_state_update', matchInfo.match_state, () => {});
              }
              // Send current player stats
              if (matchInfo.player_stats && matchInfo.player_stats !== null) {
                try {
                  const statsStr = matchInfo.player_stats;
                  const stats = typeof statsStr === 'string' ? JSON.parse(statsStr) : statsStr;
                  overwolf.windows.sendMessage(res.window.id, 'stats_update', stats, () => {});
                } catch(e) { console.error(e); }
              }
            }
          });
        }
      });
    } else {
      // Retry registration if the game pipeline is loading up slowly
      setTimeout(registerFeatures, 2000);
    }
  });
}

function registerGameEvents() {
  // 1. Set the features you want to listen to
  overwolf.games.events.setRequiredFeatures(['stats', 'match_info'], (result) => {
    if (result.status === 'error') {
      console.error("Failed to set features:", result.error);
      // Retry after a couple of seconds if it fails
      setTimeout(registerGameEvents, 2000);
    } else {
      print("Successfully registered Overwolf GEP features:", result.supportedFeatures);
    }
  });
}

// 2. Subscribe to real-time GEP updates
function setupEventListeners() {
  // Listen for Info Updates
  overwolf.games.events.onInfoUpdates2.addListener((info) => {
    if (info.feature === "match_info" && info.info.match_info) {
      const matchInfo = info.info.match_info;

      // Forward Stats
      if (matchInfo.player_stats !== undefined && matchInfo.player_stats !== null) {
        try {
          const stats = typeof matchInfo.player_stats === 'string' ? JSON.parse(matchInfo.player_stats) : matchInfo.player_stats;
          overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
            if (res.status === 'success') overwolf.windows.sendMessage(res.window.id, 'stats_update', stats, () => {});
          });
        } catch (e) { console.error(e); }
      }

      // Forward Match State
      if (matchInfo.match_state) {
        overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
          if (res.status === 'success') overwolf.windows.sendMessage(res.window.id, 'match_state_update', matchInfo.match_state, () => {});
        });
      }
    }
  });

  // Listen for Triggered Events
  overwolf.games.events.onNewEvents.addListener((info) => {
      const matchEvents = info.events.filter(e => e.name === 'match_start' || e.name === 'match_end');
      matchEvents.forEach(event => {
          overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
            if (res.status === 'success') overwolf.windows.sendMessage(res.window.id, 'match_event', event.name, () => {});
          });
      });
  });
}


// --- App Lifecycle Hooks ---
overwolf.games.getRunningGameInfo((gameInfo) => {
  if (gameInfo && gameInfo.isRunning && gameInfo.classId === MARVEL_RIVALS_ID) {
    openOverlayWindow();
    registerGameEvents();
    registerFeatures();
  }
});

overwolf.games.onGameInfoUpdated.addListener((event) => {
  if (event && event.runningChanged && event.gameInfo) {
    if (event.gameInfo.classId === MARVEL_RIVALS_ID) {
      if (event.gameInfo.isRunning) {
        openOverlayWindow();
        registerFeatures();
      } else {
        closeOverlayWindow();
      }
    }
  }
});
