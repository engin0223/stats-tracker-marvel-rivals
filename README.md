# Marvel Rivals Healing Tracker

A real-time healing tracker overlay for Marvel Rivals using Windows OCR and Overwolf, providing live healing statistics during matches.

## Quick Start

**Windows Users:** Double-click `start.bat` to launch everything automatically!
- Right-click and select "Run as Administrator" for best results (enables hotkeys)

## Features

- 🎮 Real-time healing tracking via Windows OCR
- 📊 Live HPM (Healing Per Minute) calculation
- ⌨️ Global hotkeys (Tab to scan, Shift+Plus/Minus for controls)
- 🎨 Customizable overlay with draggable positioning
- 🔄 Auto-restarting backend service
- 🖱️ Click-through transparent overlay when locked

## Installation

### Prerequisites
- Python 3.8+ (installed and in PATH)
- Node.js 14+ 
- Overwolf installed
- Marvel Rivals installed

### Setup

1. **Install Python dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

2. **Install Node dependencies:**
   ```powershell
   npm install
   ```

3. **Run the app:**
   - **Easy:** Double-click `start.bat`
   - **Manual:** Run `npm run backend` in PowerShell, then launch Overwolf

4. **Build for Overwolf:**
   ```powershell
   npm run build
   ```

## How to Use

| Action | Hotkey | Button |
|--------|--------|--------|
| Scan healing value | **Tab** | N/A |
| Start/Pause timer | **Shift+Plus** | ▶ / ⏸ |
| Reset stats | **Shift+Minus** | ⟲ |
| Move overlay | Drag | 🔓 unlock first |

**Note:** Hotkeys work best when run as Administrator.

## Project Structure

```
healing_tracker/
├── backend.py                  # Python OCR backend
├── launcher.js                 # Node.js backend launcher  
├── start.bat                   # Windows startup script
├── src/
│   ├── HealingOverlay.jsx      # React overlay component
│   ├── HealingOverlay.css      # Styling
│   └── main.jsx                # Entry point
├── dist/                       # Overwolf build
├── package.json                # Node dependencies
├── requirements.txt            # Python dependencies
├── manifest.json               # Overwolf manifest
├── vite.config.js              # Vite config
└── SETUP.md                    # Detailed setup guide
```

## Configuration

Edit `backend.py` to adjust:
- Healing box coordinates: `HEALING_BOX`
- Color detection: `TARGET_COLOR_LOWER/UPPER`
- Sensitivity: `MIN_COLOR_PIXELS`

See [SETUP.md](SETUP.md) for detailed instructions.

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Development

To start the development server:

```bash
npm run dev
```

This will build and watch for changes using Vite.

## Building for Distribution

To create an optimized production build:

```bash
npm run build
```

The built files will be ready for distribution as a browser extension or web application.

## Usage

1. Load the extension in your browser (steps vary by browser)
2. Launch Marvel Rivals
3. The healing tracker overlay will appear during matches
4. Monitor your healing statistics in real-time

## Technologies Used

- **React** - UI component framework
- **Vite** - Build tool and dev server
- **CSS3** - Styling for the overlay

## License

[Add your license information here]

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.
