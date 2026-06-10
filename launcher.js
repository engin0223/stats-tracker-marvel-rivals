import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine Python executable
const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
const backendScript = path.join(__dirname, 'backend.py');

let backendProcess = null;

// Check if backend is already running on port 5000
function checkBackendRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5000/api/healing', (res) => {
      resolve(true);
      req.abort();
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    setTimeout(() => {
      req.abort();
      resolve(false);
    }, 2000);
  });
}

function startBackend() {
  if (backendProcess && !backendProcess.killed) {
    console.log('[Backend] Already running');
    return;
  }

  console.log('[Launcher] Starting Marvel Rivals Healing Tracker Backend...');
  
  try {
    backendProcess = spawn(pythonExe, [backendScript], {
      cwd: __dirname,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      detached: false
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data}`);
    });

    backendProcess.on('close', (code) => {
      console.log(`[Launcher] Backend process exited with code ${code}`);
      // Auto-restart after 5 seconds if it crashes
      if (!process.exitCode) {
        console.log('[Launcher] Restarting backend in 5 seconds...');
        setTimeout(startBackend, 5000);
      }
    });

    console.log(`[Launcher] Backend process started (PID: ${backendProcess.pid})`);
  } catch (error) {
    console.error('[Launcher] Failed to start backend:', error);
    console.error('[Launcher] Make sure Python is installed and accessible from command line');
  }
}

// Initialize: Check if backend is running, if not start it
(async () => {
  const isRunning = await checkBackendRunning();
  
  if (isRunning) {
    console.log('[Launcher] Backend is already running on http://localhost:5000');
    console.log('[Launcher] Press Ctrl+C to stop');
  } else {
    console.log('[Launcher] Backend not detected, starting now...');
    startBackend();
  }
})();

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    console.log('[Launcher] Stopping backend...');
    backendProcess.kill();
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n[Launcher] Shutting down...');
  stopBackend();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopBackend();
  process.exit(0);
});

// Keep the launcher running
console.log('[Launcher] Launcher running. Press Ctrl+C to stop.');
console.log('[Launcher] Backend should be available at http://localhost:5000');
