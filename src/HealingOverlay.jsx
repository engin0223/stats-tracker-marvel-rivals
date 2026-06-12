import React, { useState, useEffect } from 'react';
import './HealingOverlay.css';

export default function StatsOverlay() {
  const [stats, setStats] = useState({ 
    total_heal: 0, 
    damage_dealt: 0, 
    damage_block: 0,
    accuracy: 0
  });
  
  const [matchTime, setMatchTime] = useState(0); // in seconds
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Handle the Match Timer
  useEffect(() => {
    let interval = null;
    if (isMatchActive) {
      interval = setInterval(() => {
        setMatchTime(prev => prev + 1);
      }, 1000);
    } else if (!isMatchActive && matchTime !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isMatchActive, matchTime]);

  // Handle Overwolf Messages
  useEffect(() => {
    if (typeof overwolf !== 'undefined') {
      
      const handleMessage = (message) => {
        
        // Handle Stat Updates
        if (message.id === 'stats_update') {
           const payload = message.content;
           setStats(prev => ({
             total_heal: payload.total_heal !== undefined ? payload.total_heal : prev.total_heal,
             damage_dealt: payload.damage_dealt !== undefined ? payload.damage_dealt : prev.damage_dealt,
             damage_block: payload.damage_block !== undefined ? payload.damage_block : prev.damage_block,
             accuracy: payload.accuracy !== undefined ? payload.accuracy : prev.accuracy
           }));
        }
        
        // Handle Persistent Match State Info
        if (message.id === 'match_state_update') {
            const state = message.content;
            if (state === 'in_progress' || state === 'active') {
                setIsMatchActive(true);
            } else if (state === 'ended' || state === 'inactive') {
                setIsMatchActive(false);
            }
        }

        // Handle Triggered Match Events
        if (message.id === 'match_event') {
            if (message.content === 'match_start') {
                setStats({ total_heal: 0, damage_dealt: 0, damage_block: 0, accuracy: 0 });
                setMatchTime(0);
                setIsMatchActive(true);
            } else if (message.content === 'match_end') {
                setIsMatchActive(false);
            }
        }
      };
      
      overwolf.windows.onMessageReceived.addListener(handleMessage);

      // Handle Overlay Move Toggle
      const handleHotkey = (hotkeyEvent) => {
        if (hotkeyEvent.name === 'toggle_edit') {
          setIsEditMode(prev => !prev);
        }
      };

      overwolf.settings.hotkeys.onPressed.addListener(handleHotkey);

      return () => {
        overwolf.windows.onMessageReceived.removeListener(handleMessage);
        overwolf.settings.hotkeys.onPressed.removeListener(handleHotkey);
      };
    }
  }, []);

  const handleWindowDrag = () => {
    if (typeof overwolf === 'undefined') return;
    overwolf.windows.getCurrentWindow((result) => {
      if (result.status === 'success') {
        overwolf.windows.dragMove(result.window.id);
      }
    });
  };

  // Helper functions for display
  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getPerMin = (value) => {
    if (matchTime === 0 || value === 0) return 0;
    const minutes = matchTime / 60;
    return Math.round(value / minutes);
  };

  return (
    <div 
      className={`tracker-container ${isEditMode ? 'unlocked' : ''}`}
      onMouseDown={handleWindowDrag}
    >
      <div className="stat-row timer-row">
        <span className="label">Match Time:</span> 
        <span className="value">{formatTime(matchTime)}</span>
      </div>
      <hr className="divider" />
      
      <div className="stat-row">
        <span className="label">Healing:</span> 
        <span className="value">
          {stats.total_heal} <span className="per-min">({getPerMin(stats.total_heal)}/m)</span>
        </span>
      </div>
      
      <div className="stat-row">
        <span className="label">Damage:</span> 
        <span className="value">
          {stats.damage_dealt} <span className="per-min">({getPerMin(stats.damage_dealt)}/m)</span>
        </span>
      </div>
      
      <div className="stat-row">
        <span className="label">Blocked:</span> 
        <span className="value">
          {stats.damage_block} <span className="per-min">({getPerMin(stats.damage_block)}/m)</span>
        </span>
      </div>

      <div className="stat-row">
        <span className="label">Accuracy:</span> 
        <span className="value">{stats.accuracy}%</span>
      </div>
      
      <div className="button-group">
        <button 
          className="lock-toggle" 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setIsEditMode(!isEditMode)}
          title="Shift+8 or click to toggle move"
        >
          {isEditMode ? "🔓" : "🔒"}
        </button>
      </div>
    </div>
  );
}
