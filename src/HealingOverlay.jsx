import React, { useState, useEffect, useRef } from 'react';
import './HealingOverlay.css';

const BACKEND_URL = 'http://localhost:5000/api';

export default function HealingOverlay() {
  const [healing, setHealing] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);

  const timerRef = useRef(null);
  const fetchRef = useRef(null);

  // Fetch healing data from backend
  const fetchHealingData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/healing`);
      if (response.ok) {
        const data = await response.json();
        setHealing(data.healing);
        setElapsedTime(data.elapsed_time);
        setIsTimerRunning(data.timer_running);
        setBackendConnected(true);
      }
    } catch (err) {
      console.warn("Backend not available - is the Python service running?", err);
      setBackendConnected(false);
    }
  };

  // Toggle timer via backend
  const handleToggleTimer = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/timer/toggle`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setIsTimerRunning(data.status === 'running');
        await fetchHealingData();
      }
    } catch (err) {
      console.error("Error toggling timer:", err);
    }
  };

  // Reset stats via backend
  const handleResetStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/stats/reset`, { method: 'POST' });
      if (response.ok) {
        await fetchHealingData();
      }
    } catch (err) {
      console.error("Error resetting stats:", err);
    }
  };

  useEffect(() => {
    // Initial data fetch
    fetchHealingData();

    // Setup Overwolf hotkeys if available
    if (typeof overwolf !== 'undefined') {
      const handleHotkey = (hotkeyEvent) => {
        if (hotkeyEvent.name === 'toggle_timer') {
          handleToggleTimer();
        } else if (hotkeyEvent.name === 'reset_stats') {
          handleResetStats();
        } else if (hotkeyEvent.name === 'toggle_edit') {
          setIsEditMode(prev => !prev);
        }
      };

      overwolf.settings.hotkeys.onPressed.addListener(handleHotkey);
      return () => {
        overwolf.settings.hotkeys.onPressed.removeListener(handleHotkey);
      };
    }
  }, []);

  // Continuous polling for backend data
  useEffect(() => {
    fetchRef.current = setInterval(() => {
      fetchHealingData();
    }, 500); // Poll every 500ms for smooth updates

    return () => clearInterval(fetchRef.current);
  }, []);

  // Clock progression loop (UI only, actual time comes from backend)
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  const minutes = elapsedTime / 60;
  const hpm = minutes > 0 ? Math.round(healing / minutes) : 0;

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Replaces Tkinter manual drag offset mathematics completely
  const handleWindowDrag = () => {
    if (typeof overwolf === 'undefined') return;
    overwolf.windows.getCurrentWindow((result) => {
      if (result.status === 'success') {
        overwolf.windows.dragMove(result.window.id);
      }
    });
  };

  return (
    <div 
      className={`tracker-container ${isEditMode ? 'unlocked' : ''}`}
      onMouseDown={handleWindowDrag}
    >
      <div className="backend-status">
        {backendConnected ? (
          <span className="status-indicator" title="Backend connected">●</span>
        ) : (
          <span className="status-indicator error" title="Backend not running">●</span>
        )}
      </div>
      
      <div className="stat-row">
        <span className="label">Healing:</span> 
        <span className="value">{healing.toLocaleString()}</span>
      </div>
      <div className="stat-row">
        <span className="label">Time:</span> 
        <span className="value">{formatTime(elapsedTime)}</span>
      </div>
      <div className="stat-row">
        <span className="label">HPM:</span> 
        <span className="value">{hpm.toLocaleString()}</span>
      </div>
      
      <div className="button-group">
        <button 
          className="control-button" 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleToggleTimer}
          title="Shift+Plus or click to toggle timer"
        >
          {isTimerRunning ? "⏸ Pause" : "▶ Start"}
        </button>
        
        <button 
          className="control-button" 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleResetStats}
          title="Shift+Minus or click to reset"
        >
          ⟲ Reset
        </button>
        
        <button 
          className="lock-toggle" 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setIsEditMode(!isEditMode)}
          title="Shift+8 or click to toggle"
        >
          {isEditMode ? "🔓" : "🔒"}
        </button>
      </div>
    </div>
  );
}