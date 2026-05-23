import { useState, useEffect, useRef } from 'react';
import './App.css';
import { formatNumber } from './utils';
import { DamageMeter, loadColVisibility } from './components/DamageMeter';
import type { ColumnId } from './components/DamageMeter';
import { ReportModal } from './components/ReportModal';
import { SettingsModal } from './components/SettingsModal';
import { parseLogLine } from './parser';
import { createEmptyEncounter, applyEvents } from './encounter';
import type { EncounterState, DamageEvent } from './types';
// @ts-ignore
import packageJson from '../package.json';

const MAX_HISTORY = 3;

function App() {
  const [logFolder, setLogFolder] = useState<string | null>(localStorage.getItem('damageLoggerFolder'));
  const [encounter, setEncounter] = useState<EncounterState>(createEmptyEncounter());
  const [encounterHistory, setEncounterHistory] = useState<EncounterState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 = viewing live data
  const [activeTab, setActiveTab] = useState<'dealt' | 'received'>('dealt');
  const [opacity, setOpacity] = useState(0.85);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isMinimalist, setIsMinimalist] = useState(false);
  const [primaryMetric, setPrimaryMetric] = useState<'total' | 'dps'>('total');
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnId, boolean>>(loadColVisibility);
  const [meterKey, setMeterKey] = useState<number>(0);
  const meterRef = useRef<any>(null);

  // ── Global IPC listeners (run once) ─────────────────────────────
  useEffect(() => {
    const unsubLock = window.electronAPI.onLockStateChanged((locked) => setIsLocked(locked));
    const unsubMinimalist = window.electronAPI.onToggleMinimalist(() => setIsMinimalist(prev => !prev));
    const unsubLog = window.electronAPI.onBackendLog((msg: string) => console.log('BACKEND:', msg));
    const unsubCollapse = window.electronAPI.onToggleCollapseExpand(() => {
      meterRef.current?.toggleCollapseExpandAll();
    });

    return () => {
      unsubLock();
      unsubMinimalist();
      unsubLog();
      unsubCollapse();
    };
  }, []);

  // ── GitHub Latest Release Update Checker ────────────────────────
  useEffect(() => {
    fetch('https://api.github.com/repos/Monddoc/Hellclock-DPSMeter/releases/latest')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch latest release');
        return res.json();
      })
      .then(data => {
        const latestTag = data.tag_name;
        if (latestTag) {
          const latestVersion = latestTag.startsWith('v') ? latestTag.substring(1) : latestTag;
          const localVersion = packageJson.version;

          if (latestVersion !== localVersion) {
            const latestParts = latestVersion.split('.').map(Number);
            const localParts = localVersion.split('.').map(Number);
            let isNewer = false;
            for (let i = 0; i < 3; i++) {
              const latVal = latestParts[i] || 0;
              const locVal = localParts[i] || 0;
              if (latVal > locVal) {
                isNewer = true;
                break;
              } else if (latVal < locVal) {
                break;
              }
            }
            if (isNewer) {
              setUpdateAvailable(latestTag);
            }
          }
        }
      })
      .catch(err => console.error('Update checker error:', err));
  }, []);

  // ── Shortcut-triggered actions (reset / report) ─────────────────
  useEffect(() => {
    const unsubReset = window.electronAPI.onResetEncounter(() => {
      handleReset();
    });
    const unsubReport = window.electronAPI.onOpenReport(() => {
      setShowReport(true);
    });

    return () => {
      unsubReset();
      unsubReport();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter]); // Re-register when encounter changes so handleReset captures latest state

  // ── Log file watching ───────────────────────────────────────────
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

    const unsubLines = window.electronAPI.onNewLogLines(handleLines);
    const unsubCleared = window.electronAPI.onLogCleared(handleCleared);

    return () => {
      unsubLines();
      unsubCleared();
    };
  }, [logFolder]);

  const handleReset = () => {
    // Save current encounter to history (only if it has data)
    if (encounter.totalDamageDealt > 0 || encounter.totalDamageReceived > 0) {
      setEncounterHistory(prev => [encounter, ...prev].slice(0, MAX_HISTORY));
    }
    setHistoryIndex(-1);
    setEncounter(createEmptyEncounter());
  };

  const handleResetAllConfigs = () => {
    localStorage.removeItem('hellclock_col_widths');
    localStorage.removeItem('hellclock_col_visibility');
    const defaultVis = { source: true, skill: true, sid: false, type: true, hits: true, maxHit: true, damage: true };
    setColumnVisibility(defaultVis);
    setMeterKey(prev => prev + 1);
    
    // Reset opacity
    setOpacity(0.85);
    window.electronAPI.setOpacity(1.0);
    document.documentElement.style.setProperty('--bg-color', 'rgba(15, 15, 20, 0.85)');
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

  const activeSec = Math.max(displayedEncounter.activeDurationMs, 1000) / 1000;
  const totalDealtDps = displayedEncounter.totalDamageDealt / activeSec;
  const totalReceivedDps = displayedEncounter.totalDamageReceived / activeSec;

  return (
    <div className={`app-container ${isMinimalist ? 'minimalist' : ''} ${isLocked ? 'locked' : ''}`} style={{ '--bg-color': isMinimalist ? 'transparent' : `rgba(15, 15, 20, ${opacity})` } as React.CSSProperties}>

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
          <button className="control-btn" onClick={() => window.electronAPI.requestToggleMinimalist()} title="Minimalist Mode (F9)">🗗</button>
          <button className="control-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
          <button className="control-btn" onClick={() => window.electronAPI.windowControl('minimize')}>_</button>
          <button className="control-btn close" onClick={() => window.electronAPI.windowControl('close')}>×</button>
        </div>
      </div>

      {updateAvailable && (
        <div 
          className="update-banner"
          onClick={() => window.open('https://github.com/Monddoc/Hellclock-DPSMeter/releases', '_blank')}
          title="Click to view releases on GitHub"
        >
          ✨ New Version {updateAvailable} Available! Click to Update
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${activeTab === 'dealt' ? 'active' : ''}`} onClick={() => setActiveTab('dealt')}>Dealt</button>
        <button className={`tab ${activeTab === 'received' ? 'active' : ''}`} onClick={() => setActiveTab('received')}>Received</button>
      </div>

      <div className="content">
        <div className="encounter-header">
          <span>{activeSec.toFixed(1)}s Combat</span>
          <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span>
              {activeTab === 'dealt'
                ? (primaryMetric === 'total' ? formatNumber(displayedEncounter.totalDamageDealt) : formatNumber(totalDealtDps))
                : (primaryMetric === 'total' ? formatNumber(displayedEncounter.totalDamageReceived) : formatNumber(totalReceivedDps))}
              {primaryMetric === 'total' ? ' Total' : ' DPS'}
            </span>
            <span style={{ color: '#ff9944', fontSize: '11px', fontWeight: '600' }}>
              ⚡ {formatNumber(activeTab === 'dealt' ? displayedEncounter.peakDpsDealt : displayedEncounter.peakDpsReceived)} Peak
            </span>
          </span>
        </div>

        <DamageMeter
          ref={meterRef}
          key={meterKey}
          encounter={displayedEncounter}
          activeTab={activeTab}
          primaryMetric={primaryMetric}
          columnVisibility={columnVisibility}
        />

        {activeTab === 'received' && displayedEncounter.lastHitReceived && (
          <div style={{ padding: '8px', background: 'rgba(255, 69, 0, 0.1)', border: '1px solid rgba(255, 69, 0, 0.3)', borderRadius: '4px', marginTop: '8px', fontSize: '12px' }}>
            <div style={{ color: 'var(--color-fire)', fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>LATEST HIT RECEIVED</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '500' }}>{displayedEncounter.lastHitReceived.source} — {displayedEncounter.lastHitReceived.skillName} <span style={{ color: '#666', fontSize: '10px' }}>SID:{displayedEncounter.lastHitReceived.skillId}</span></span>
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
              {i + 1}
            </button>
          ))}
          <button
            className="toolbar-btn"
            onClick={() => setPrimaryMetric(p => p === 'total' ? 'dps' : 'total')}
            title={`Currently showing ${primaryMetric === 'total' ? 'Total Damage' : 'DPS'}. Click to switch.`}
          >
            {primaryMetric === 'total' ? 'Show DPS' : 'Show Total'}
          </button>
          <button className="toolbar-btn" onClick={() => setShowReport(true)}>Details</button>
          {isViewingHistory
            ? <button className="toolbar-btn" onClick={() => setHistoryIndex(-1)}>← Live</button>
            : <button className="toolbar-btn" onClick={handleReset}>Reset</button>
          }
        </div>
      </div>

      {showReport && <ReportModal encounter={displayedEncounter} onClose={() => setShowReport(false)} />}
      {showSettings && <SettingsModal logFolder={logFolder} onSelectFolder={handleSelectFolder} onClose={() => setShowSettings(false)} onColumnVisibilityChange={setColumnVisibility} onResetAll={handleResetAllConfigs} />}
    </div>
  );
}

export default App;
