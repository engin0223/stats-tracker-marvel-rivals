import React, { useState, useEffect, useRef } from 'react';
import './HealingOverlay.css';

export default function HealingOverlay() {
  const [healing, setHealing] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof overwolf === 'undefined') {
      console.warn("Overwolf API not available - running in dev mode");
      return;
    }

    // Intercept native game info updates broadcasted by Overwolf GEP
    const handleInfoUpdate = (update) => {
      if (update?.info?.match_info?.player_stats) {
        try {
          const stats = JSON.parse(update.info.match_info.player_stats);
          if (stats.healing !== undefined) {
            setHealing(stats.healing);
            if (stats.healing > 0) setIsTimerRunning(true);
          }
        } catch (err) {
          console.error("Error parsing player performance stats:", err);
        }
      }
    };

    // Track assigned app hotkeys 
    const handleHotkey = (hotkeyEvent) => {
      if (hotkeyEvent.name === 'toggle_timer') {
        setIsTimerRunning(prev => !prev);
      } else if (hotkeyEvent.name === 'reset_stats') {
        setHealing(0);
        setElapsedTime(0);
        setIsTimerRunning(false);
      }
    };

    overwolf.games.events.onInfoUpdates2.addListener(handleInfoUpdate);
    overwolf.settings.hotkeys.onPressed.addListener(handleHotkey);

    return () => {
      overwolf.games.events.onInfoUpdates2.removeListener(handleInfoUpdate);
      overwolf.settings.hotkeys.onPressed.removeListener(handleHotkey);
    };
  }, []);

  // Clock progression loop
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
      
      <button 
        className="lock-toggle" 
        onMouseDown={(e) => e.stopPropagation()} // Prevents dragging when clicking button
        onClick={() => setIsEditMode(!isEditMode)}
      >
        {isEditMode ? "Lock Position" : "Unlock Grid"}
      </button>
    </div>
  );
}