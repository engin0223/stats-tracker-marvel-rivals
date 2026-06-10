# Marvel Rivals Healing Tracker

A browser extension/overlay tool for tracking healing in Marvel Rivals, providing real-time healing statistics and performance monitoring during gameplay.

## Features

- Real-time healing tracking overlay
- Displays healing statistics during matches
- Lightweight and non-intrusive overlay design
- Built with React and Vite for optimal performance

## Project Structure

```
healing_tracker/
├── src/
│   ├── HealingOverlay.jsx      # Main overlay component
│   ├── HealingOverlay.css      # Overlay styling
│   └── main.jsx                # React entry point
├── public/
│   └── manifest.json           # Extension manifest
├── background.js               # Background script for extension
├── index.html                  # HTML entry point
├── manifest.json               # Extension configuration
├── package.json                # Project dependencies
├── vite.config.js              # Vite configuration
└── README.md                   # This file
```

## Installation

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
