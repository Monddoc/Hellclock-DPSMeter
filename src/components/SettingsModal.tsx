import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Keybindings } from '../types';
import { ALL_COLUMNS, COLUMN_LABELS, loadColVisibility, saveColVisibility } from './DamageMeter';
import type { ColumnId } from './DamageMeter';

interface Props {
  logFolder: string | null;
  onSelectFolder: () => void;
  onClose: () => void;
  onColumnVisibilityChange: (vis: Record<ColumnId, boolean>) => void;
  onResetAll: () => void;
}

const ACTION_LABELS: Record<keyof Keybindings, string> = {
  toggleLock: 'Toggle Lock',
  toggleMinimalist: 'Toggle Minimalist',
  resetEncounter: 'Reset Encounter',
  openReport: 'Open Report',
};

const ACTION_DESCRIPTIONS: Record<keyof Keybindings, string> = {
  toggleLock: 'Lock/unlock the overlay (click-through mode)',
  toggleMinimalist: 'Enter/exit minimalist mode (auto-locks)',
  resetEncounter: 'Reset the current encounter data',
  openReport: 'Open the encounter report modal',
};

/**
 * Convert a DOM KeyboardEvent into an Electron accelerator string.
 * Returns empty string for modifier-only presses.
 */
function keyEventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  const key = e.key;

  // Ignore modifier-only presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return '';

  // Function keys
  if (/^F\d{1,2}$/.test(key)) {
    parts.push(key);
  } else if (key === ' ') {
    parts.push('Space');
  } else if (key === 'Escape') {
    // Escape always cancels capture instead of binding
    return '__CANCEL__';
  } else if (key === 'Delete' || key === 'Backspace') {
    // Allow clearing a binding
    return '__CLEAR__';
  } else if (key.length === 1) {
    parts.push(key.toUpperCase());
  } else {
    // Keys like Enter, Tab, ArrowUp, etc.
    parts.push(key);
  }

  return parts.join('+');
}

/** User-friendly display of an accelerator string */
function displayAccelerator(accel: string): string {
  if (!accel) return 'Not set';
  return accel
    .replace('CommandOrControl', 'Ctrl')
    .replace(/\+/g, ' + ');
}

export const SettingsModal: React.FC<Props> = ({ logFolder, onSelectFolder, onClose, onColumnVisibilityChange, onResetAll }) => {
  const [bindings, setBindings] = useState<Keybindings | null>(null);
  const [editedBindings, setEditedBindings] = useState<Keybindings | null>(null);
  const [listeningFor, setListeningFor] = useState<keyof Keybindings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<keyof Keybindings | null>(null);

  // Column visibility state
  const [colVisibility, setColVisibility] = useState<Record<ColumnId, boolean>>(loadColVisibility);

  // Keep ref in sync for the keyboard handler
  useEffect(() => { listenerRef.current = listeningFor; }, [listeningFor]);

  // Load current keybindings on mount
  useEffect(() => {
    window.electronAPI.getKeybindings().then(kb => {
      setBindings(kb);
      setEditedBindings({ ...kb });
    });
  }, []);

  // Global key capture when listening
  const handleKeyCapture = useCallback((e: KeyboardEvent) => {
    const action = listenerRef.current;
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    const accel = keyEventToAccelerator(e);
    if (!accel) return; // modifier-only, keep listening

    if (accel === '__CANCEL__') {
      setListeningFor(null);
      return;
    }

    setEditedBindings(prev => {
      if (!prev) return prev;
      return { ...prev, [action]: accel === '__CLEAR__' ? '' : accel };
    });
    setListeningFor(null);
    setError(null);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyCapture, true);
    return () => window.removeEventListener('keydown', handleKeyCapture, true);
  }, [handleKeyCapture]);

  const handleToggleColumn = (col: ColumnId) => {
    // Prevent hiding all columns — at least one must remain
    const newVis = { ...colVisibility, [col]: !colVisibility[col] };
    const visibleCount = Object.values(newVis).filter(Boolean).length;
    if (visibleCount === 0) return;

    setColVisibility(newVis);
    saveColVisibility(newVis);
    onColumnVisibilityChange(newVis);
  };

  const handleSave = async () => {
    if (!editedBindings) return;

    // Validate: check for duplicate bindings (excluding empty)
    const values = Object.entries(editedBindings)
      .filter(([_, v]) => v !== '')
      .map(([k, v]) => ({ action: k as keyof Keybindings, accel: v }));

    const seen = new Map<string, string>();
    for (const { action, accel } of values) {
      if (seen.has(accel)) {
        setError(`"${displayAccelerator(accel)}" is already used by "${ACTION_LABELS[seen.get(accel)! as keyof Keybindings]}"`);
        return;
      }
      seen.set(accel, action);
    }

    setSaving(true);
    setError(null);
    const ok = await window.electronAPI.saveKeybindings(editedBindings);
    setSaving(false);

    if (ok) {
      setBindings({ ...editedBindings });
      onClose();
    } else {
      setError('Failed to save keybindings.');
    }
  };

  const handleResetDefaults = async () => {
    const DEFAULT_KEYBINDINGS = {
      toggleLock: 'F8',
      toggleMinimalist: 'F9',
      resetEncounter: '',
      openReport: ''
    };

    setSaving(true);
    setError(null);
    const ok = await window.electronAPI.saveKeybindings(DEFAULT_KEYBINDINGS);
    setSaving(false);

    if (ok) {
      setBindings(DEFAULT_KEYBINDINGS);
      setEditedBindings(DEFAULT_KEYBINDINGS);
      onResetAll();
      onClose();
    } else {
      setError('Failed to reset keybindings to default.');
    }
  };

  const hasChanges = bindings && editedBindings &&
    JSON.stringify(bindings) !== JSON.stringify(editedBindings);

  if (!editedBindings) {
    return (
      <div className="modal-overlay">
        <div className="modal-content settings-modal">
          <div style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content settings-modal">
        {/* Header */}
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="control-btn close" onClick={onClose} style={{ fontSize: '20px' }}>×</button>
        </div>

        {/* Game Folder */}
        <div className="settings-section">
          <div className="settings-section-title">GAME FOLDER</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="settings-folder-path">
              {logFolder || 'No folder selected'}
            </div>
            <button className="primary-btn" style={{ padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap' }} onClick={onSelectFolder}>
              📁 Change
            </button>
          </div>
        </div>

        {/* Column Visibility */}
        <div className="settings-section">
          <div className="settings-section-title">VISIBLE COLUMNS</div>
          <div className="settings-hint">
            Toggle which columns appear in the damage meter. Drag column edges in the meter to resize.
          </div>
          <div className="column-toggle-list">
            {ALL_COLUMNS.map(col => (
              <label key={col} className="column-toggle-row">
                <input
                  type="checkbox"
                  checked={colVisibility[col]}
                  onChange={() => handleToggleColumn(col)}
                />
                <span className="column-toggle-label">{COLUMN_LABELS[col]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Keybindings */}
        <div className="settings-section">
          <div className="settings-section-title">KEYBINDINGS</div>
          <div className="settings-hint">
            Click a field and press a key to rebind. Press <strong>Esc</strong> to cancel, <strong>Delete</strong> to clear.
            <br/>Ctrl + Shift + L always works as a lock toggle fallback.
          </div>

          <div className="keybinding-list">
            {(Object.keys(ACTION_LABELS) as (keyof Keybindings)[]).map(action => {
              const isListening = listeningFor === action;
              const value = editedBindings[action];

              return (
                <div key={action} className="keybinding-row">
                  <div className="keybinding-info">
                    <div className="keybinding-label">{ACTION_LABELS[action]}</div>
                    <div className="keybinding-desc">{ACTION_DESCRIPTIONS[action]}</div>
                  </div>
                  <button
                    className={`keybinding-capture ${isListening ? 'listening' : ''}`}
                    onClick={() => setListeningFor(isListening ? null : action)}
                  >
                    {isListening ? '⏳ Press a key...' : displayAccelerator(value)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="settings-error">{error}</div>
        )}

        {/* Footer */}
        <div className="settings-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="toolbar-btn"
            style={{ color: '#ff5555', border: '1px solid rgba(255, 85, 85, 0.4)', background: 'transparent' }}
            onClick={handleResetDefaults}
            disabled={saving}
          >
            Reset to Defaults
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="toolbar-btn" onClick={onClose}>Cancel</button>
            <button
              className="primary-btn"
              style={{ padding: '8px 20px', fontSize: '12px', opacity: hasChanges ? 1 : 0.5 }}
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
