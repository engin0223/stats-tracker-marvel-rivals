const MARVEL_RIVALS_ID = 21854;
const REGISTER_FEATURES = ['match_info'];

function openOverlayWindow() {
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (result.status === 'success') {
      console.log("Opening overlay window");
      overwolf.windows.restore(result.window.id, (restoreResult) => {
        if (restoreResult.status === 'success') {
          console.log("Overlay window restored successfully");
        } else {
          console.error("Failed to restore overlay window:", restoreResult);
        }
      });
    } else {
      console.error("Failed to obtain overlay window:", result);
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
    if (result.success) {
      console.log("Registered for Marvel Rivals match data successfully.");
    } else {
      // Retry registration if the game pipeline is loading up slowly
      setTimeout(registerFeatures, 2000);
    }
  });
}

// Open the overlay when the app starts and the game is already running
overwolf.games.getRunningGameInfo((gameInfo) => {
  if (gameInfo && gameInfo.isRunning && gameInfo.id === MARVEL_RIVALS_ID) {
    console.log("Game is already running, opening overlay");
    openOverlayWindow();
    registerFeatures();
  }
});

// Open the HUD overlay panel when the game launches
overwolf.games.onGameLaunched.addListener((game) => {
  if (game.id === MARVEL_RIVALS_ID) {
    console.log("Game launched, opening overlay");
    openOverlayWindow();
    registerFeatures();
  }
});

// Close the overlay when the game closes
overwolf.games.onGameClosed.addListener((game) => {
  if (game.id === MARVEL_RIVALS_ID) {
    console.log("Game closed, closing overlay");
    closeOverlayWindow();
  }
});