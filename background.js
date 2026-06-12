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

function registerFeatures() {
  overwolf.games.events.setRequiredFeatures(REGISTER_FEATURES, (result) => {
    if (result.status === 'success' || result.success) {
      console.log("Successfully registered for Marvel Rivals match data.");
      
      // 1. Setup real-time listeners for future events
      setupEventListeners();

      // 2. GEP BEST PRACTICE: Fetch current info immediately in case app started mid-match
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
                } catch(e) {}
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

function setupEventListeners() {
  // Listen for Info Updates
  overwolf.games.events.onInfoUpdates2.addListener((info) => {
    // Check for player stats
    if (info.feature === "match_info" && info.info.match_info && info.info.match_info.player_stats !== undefined) {
      const statsStr = info.info.match_info.player_stats;
      
      // GEP null reset rule: Ignore Overwolf's 'null' reset values between matches
      if (statsStr === null) {
         return; 
      }
      
      try {
        const stats = typeof statsStr === 'string' ? JSON.parse(statsStr) : statsStr;
        overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
          if (res.status === 'success') {
             overwolf.windows.sendMessage(res.window.id, 'stats_update', stats, () => {});
          }
        });
      } catch (e) {
        console.error("Failed to parse player_stats:", e);
      }
    }

    // Check for match state
    if (info.feature === "match_info" && info.info.match_info && info.info.match_info.match_state) {
        const matchState = info.info.match_info.match_state;
        overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
          if (res.status === 'success') {
             overwolf.windows.sendMessage(res.window.id, 'match_state_update', matchState, () => {});
          }
        });
    }
  });

  // Listen for real-time Events
  overwolf.games.events.onNewEvents.addListener((info) => {
      const matchEvents = info.events.filter(e => e.name === 'match_start' || e.name === 'match_end');
      matchEvents.forEach(event => {
          overwolf.windows.obtainDeclaredWindow('overlay', (res) => {
            if (res.status === 'success') {
               overwolf.windows.sendMessage(res.window.id, 'match_event', event.name, () => {});
            }
          });
      });
  });
}

// Lifecycle Hooks
overwolf.games.getRunningGameInfo((gameInfo) => {
  if (gameInfo && gameInfo.isRunning && gameInfo.classId === MARVEL_RIVALS_ID) {
    openOverlayWindow();
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
