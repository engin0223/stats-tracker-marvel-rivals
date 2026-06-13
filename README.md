# Marvel Rivals Stats Tracker Overlay

A real-time stats tracker overlay for Marvel Rivals built on the Overwolf platform, providing live healing, damage, mitigation, and accuracy statistics automatically during matches.

> **⚠️ Disclaimer:** This application is currently in very early development. It is planned to be released publicly once development finishes. Please note that by using this early build, the user assumes full responsibility for any problems or issues that may occur.

## Features

- 🎮 **Automatic Tracking:** Real-time stat tracking via Overwolf Game Events (no manual scanning required).
- 📊 **Live Analytics:** Calculates live Per-Minute stats (Healing/Damage/Blocked per minute).
- 🎨 **Customizable Overlay:** Draggable, transparent overlay that sits neatly on your screen.
- ⏱️ **Auto Match Timer:** Automatically detects match start/end and tracks match duration.
- 🖱️ **Click-Through:** Fully transparent and non-intrusive when locked.

## Prerequisites

- Node.js 18+ (for building the project)
- [Overwolf Client](https://www.overwolf.com/) installed
- Marvel Rivals installed

## Installation & Setup

1. **Clone the repository:**
```bash
   git clone <your-repo-url>
   cd healing_tracker

```

2. **Install dependencies:**

```bash
   npm install

```

3. **Build the Overwolf extension:**

```bash
   npm run build

```

*This will compile the React app and copy the necessary Overwolf files (`manifest.json`, `background.js`, `background.html`) into the `dist/` folder.*

4. **Load into Overwolf:**
* Open Overwolf settings.
* Go to **About** -> **Development Options**.
* Click **Load unpacked extension...**
* Select the `dist/` folder generated in step 3.



## How to Use

Once the app is loaded and enabled in Overwolf:

1. Launch **Marvel Rivals**.
2. The background service will automatically detect the game and open the overlay.
3. The tracker will automatically reset and start tracking your stats as soon as you enter an active match.

### Controls / Hotkeys

| Action | Default Hotkey | Button |
| --- | --- | --- |
| Toggle Edit/Move Mode | **Shift+8** | 🔓 / 🔒 |
| Move Overlay | **Drag** | *Requires Unlock first* |

*Note: You can change this hotkey at any time in your Overwolf settings.*

## Project Structure

```
healing_tracker/
├── background.js               # Overwolf background event controller (GEP integration)
├── background.html             # Background process host
├── manifest.json               # Overwolf extension manifest
├── src/
│   ├── HealingOverlay.jsx      # React overlay component (UI and logic)
│   ├── HealingOverlay.css      # Styling for the overlay
│   └── main.jsx                # React entry point
├── public/                     # Icons and static assets
├── package.json                # Node dependencies and scripts
└── vite.config.js              # Vite bundler configuration

```

## Development

To start the development server for UI testing (outside of Overwolf):

```bash
npm run dev

```

*Note: Overwolf APIs (`overwolf.games.events`, etc.) will not be available in a standard web browser, but you can build and style the UI components.*

## Technologies Used

* **React** - UI component framework
* **Vite** - Lightning-fast build tool
* **Overwolf API** - Native game events and window management
