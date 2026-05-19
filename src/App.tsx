import { useState, useEffect, useRef } from 'react';
import './App.css';
import { formatNumber } from './utils';
import { DamageMeter } from './components/DamageMeter';
import { ReportModal } from './components/ReportModal';
import { parseLogLine } from './parser';
import { createEmptyEncounter, applyEvents } from './encounter';
import type { EncounterState, DamageEvent } from './types';

const MAX_HISTORY = 3;

function App() {
  const [logFolder, setLogFolder] = useState<string | null>(localStorage.getItem('damageLoggerFolder'));
  const [encounter, setEncounter] = useState<EncounterState>(createEmptyEncounter());
  const [encounterHistory, setEncounterHistory] = useState<EncounterState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 = viewing live data
  const [activeTab, setActiveTab] = useState<'dealt' | 'received'>('dealt');
  const [opacity, setOpacity] = useState(0.85);
  const [showReport, setShowReport] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isMinimalist, setIsMinimalist] = useState(false);
  const [primaryMetric, setPrimaryMetric] = useState<'total' | 'dps'>('total');

  // Track cleanup functions for IPC listeners
  const cleanupRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const onLockChanged = (locked: boolean) => setIsLocked(locked);
    window.electronAPI.onLockStateChanged(onLockChanged);
    unsubs.push(() => { /* ipcRenderer.removeListener handled by re-register pattern */ });

    const onExitMin = () => setIsMinimalist(false);
    window.electronAPI.onExitMinimalist(onExitMin);

    // Dev-only: pipe backend logs to the browser console
    window.electronAPI.onBackendLog((msg: string) => console.log('BACKEND:', msg));

    cleanupRefs.current = unsubs;
    return () => { cleanupRefs.current.forEach(fn => fn()); };
  }, []);

  useEffect(() => {
    if (logFolder) {
      window.electronAPI.startWatching(logFolder);
    }

    const handleLines = (lines: string[]) => {
      const newEvents: DamageEvent[] = [];
      for (const line of lines) {
        const events = parseLogLine(line);
        if (events && events.length > 0) newEvents.push(...events);
      }
      if (newEvents.length > 0) {
        setEncounter(prev => applyEvents(prev, newEvents));
      }
    };

    const handleCleared = () => setEncounter(createEmptyEncounter());

    window.electronAPI.onNewLogLines(handleLines);
    window.electronAPI.onLogCleared(handleCleared);
  }, [logFolder]);

  const handleReset = () => {
    // Save current encounter to history (only if it has data)
    if (encounter.totalDamageDealt > 0 || encounter.totalDamageReceived > 0) {
      setEncounterHistory(prev => [encounter, ...prev].slice(0, MAX_HISTORY));
    }
    setHistoryIndex(-1);
    setEncounter(createEmptyEncounter());
  };

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      setLogFolder(folderPath);
      localStorage.setItem('damageLoggerFolder', folderPath);
      handleReset();
    }
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setOpacity(val);
    document.documentElement.style.setProperty('--bg-color', `rgba(15, 15, 20, ${val})`);
  };

  if (!logFolder) {
    return (
      <div className="app-container">
        <div className="title-bar">
          <div className="title">Hell Clock DPS</div>
          <div className="window-controls">
            <button className="control-btn close" onClick={() => window.electronAPI.windowControl('close')}>×</button>
          </div>
        </div>
        <div className="setup-screen">
          <h2>Welcome</h2>
          <p>Please select your Hell Clock game folder (where Damage.log is located) to begin.</p>
          <button className="primary-btn" onClick={handleSelectFolder}>Select Game Folder</button>
        </div>
      </div>
    );
  }

  // What we're displaying: history snapshot or live encounter
  const displayedEncounter = historyIndex >= 0 ? encounterHistory[historyIndex] : encounter;
  const isViewingHistory = historyIndex >= 0;

  const durationSec = (displayedEncounter.durationMs / 1000) || 0;
  const totalDealtDps = displayedEncounter.totalDamageDealt / (durationSec || 1);
  const totalReceivedDps = displayedEncounter.totalDamageReceived / (durationSec || 1);

  return (
    <div className={`app-container ${isMinimalist ? 'minimalist' : ''} ${isLocked ? 'locked' : ''}`} style={{ '--bg-color': isMinimalist ? 'transparent' : `rgba(15, 15, 20, ${opacity})` } as React.CSSProperties}>

      {/* Minimalist exit button */}
      {isMinimalist && !isLocked && (
        <div
          onClick={() => window.electronAPI.requestExitMinimalist()}
          style={{
            position: 'fixed', top: 0, right: 0,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            cursor: 'pointer',
            zIndex: 9999,
            opacity: 0,
            transition: 'opacity 0.2s',
            borderBottomLeftRadius: '8px',
            fontSize: '11px',
            fontWeight: '600',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          title="Press F9 to exit minimalist mode"
        >
          × Exit Minimalist (F9)
        </div>
      )}

      <div className="title-bar" style={isLocked ? { WebkitAppRegion: 'no-drag', cursor: 'default' } as any : {}}>
        <div className="title">
          {isLocked ? (
            <span style={{ color: '#ff6666', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>🔒 F8 or Ctrl+Shift+L to unlock</span>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Hell Clock DPS {isViewingHistory && <span style={{ color: '#ff9944', fontSize: '10px', marginLeft: 4 }}>[History {historyIndex + 1}]</span>}
            </>
          )}
        </div>
        <div className="window-controls">
          <button className={`control-btn ${isLocked ? 'locked-btn' : ''}`} onClick={() => window.electronAPI.requestToggleLock()} title={isLocked ? "Unlock (F8)" : "Lock — click-through (F8)"}>
            {isLocked ? "🔒" : "🔓"}
          </button>
          <button className="control-btn" onClick={() => setIsMinimalist(true)} title="Minimalist Mode">🗗</button>
          <button className="control-btn" onClick={handleSelectFolder} title="Change Game Folder">⚙️</button>
          <button className="control-btn" onClick={() => window.electronAPI.windowControl('minimize')}>_</button>
          <button className="control-btn close" onClick={() => window.electronAPI.windowControl('close')}>×</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'dealt' ? 'active' : ''}`} onClick={() => setActiveTab('dealt')}>Dealt</button>
        <button className={`tab ${activeTab === 'received' ? 'active' : ''}`} onClick={() => setActiveTab('received')}>Received</button>
      </div>

      <div className="content">
        <div className="encounter-header">
          <span>{durationSec.toFixed(1)}s Combat</span>
          <span>
            {activeTab === 'dealt'
              ? (primaryMetric === 'total' ? formatNumber(displayedEncounter.totalDamageDealt) : formatNumber(totalDealtDps))
              : (primaryMetric === 'total' ? formatNumber(displayedEncounter.totalDamageReceived) : formatNumber(totalReceivedDps))}
            {primaryMetric === 'total' ? ' Total Dmg' : ' Total DPS'}
          </span>
        </div>

        <DamageMeter
          skills={activeTab === 'dealt' ? displayedEncounter.dealtSkills : displayedEncounter.receivedSkills}
          isDealtTab={activeTab === 'dealt'}
          primaryMetric={primaryMetric}
        />

        {activeTab === 'received' && displayedEncounter.lastHitReceived && (
          <div style={{ padding: '8px', background: 'rgba(255, 69, 0, 0.1)', border: '1px solid rgba(255, 69, 0, 0.3)', borderRadius: '4px', marginTop: '8px', fontSize: '12px' }}>
            <div style={{ color: 'var(--color-fire)', fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>LATEST HIT RECEIVED</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '500' }}>{displayedEncounter.lastHitReceived.source} (SK: {displayedEncounter.lastHitReceived.skillId})</span>
              <span style={{ fontWeight: 'bold' }}>
                {formatNumber(displayedEncounter.lastHitReceived.value)}
                <span style={{ color: `var(--color-${displayedEncounter.lastHitReceived.damageType.toLowerCase()})`, fontSize: '10px', marginLeft: '6px' }}>{displayedEncounter.lastHitReceived.damageType}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="slider-container">
          <span style={{color: '#888'}}>Opacity</span>
          <input type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={handleOpacityChange} />
        </div>
        <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
          {/* History navigation */}
          {encounterHistory.length > 0 && encounterHistory.map((_, i) => (
            <button
              key={i}
              className={`toolbar-btn ${historyIndex === i ? 'active' : ''}`}
              onClick={() => setHistoryIndex(historyIndex === i ? -1 : i)}
              title={`View past encounter ${i + 1}`}
              style={{ padding: '2px 6px', fontSize: '10px', minWidth: 24 }}
            >
              -{i + 1}
            </button>
          ))}
          <button
            className="toolbar-btn"
            onClick={() => setPrimaryMetric(p => p === 'total' ? 'dps' : 'total')}
            title={`Currently showing ${primaryMetric === 'total' ? 'Total Damage' : 'DPS'}. Click to switch.`}
          >
            {primaryMetric === 'total' ? 'Show DPS' : 'Show Total'}
          </button>
          <button className="toolbar-btn" onClick={() => setShowReport(true)}>Report</button>
          {isViewingHistory
            ? <button className="toolbar-btn" onClick={() => setHistoryIndex(-1)}>← Live</button>
            : <button className="toolbar-btn" onClick={handleReset}>Reset</button>
          }
        </div>
      </div>

      {showReport && <ReportModal encounter={displayedEncounter} onClose={() => setShowReport(false)} />}
    </div>
  );
}

export default App;
