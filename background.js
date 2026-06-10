const MARVEL_RIVALS_ID = 21854;
const REGISTER_FEATURES = ['match_info'];

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

// Open the HUD overlay panel when the game launches
overwolf.games.onGameLaunched.addListener((game) => {
  if (game.id === MARVEL_RIVALS_ID) {
    overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
      if (result.status === 'success') {
        overwolf.windows.restore(result.window.id);
        registerFeatures();
      }
    });
  }
});