import { useState, useEffect } from 'react';
import './App.css';
import { DamageMeter } from './components/DamageMeter';
import { ReportModal } from './components/ReportModal';
import { parseLogLine } from './parser';
import type { EncounterState, SkillDamageRow, DamageEvent } from './types';

function createEmptySkillRow(key: string, skillId: string, source: string, damageType: any): SkillDamageRow {
  return {
    key,
    skillId,
    source,
    damageType,
    totalDamage: 0,
    dps: 0,
    totalHits: 0,
    critHits: 0,
    ailmentDamage: { BLEED: 0, IGNITE: 0, NONE: 0 }
  };
}

function createEmptyEncounter(): EncounterState {
  return {
    startTime: 0,
    lastDamageTime: 0,
    durationMs: 0,
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    dealtSkills: {},
    receivedSkills: {},
    lastHitReceived: null
  };
}

function App() {
  const [logFolder, setLogFolder] = useState<string | null>(localStorage.getItem('damageLoggerFolder'));
  const [encounter, setEncounter] = useState<EncounterState>(createEmptyEncounter());
  const [activeTab, setActiveTab] = useState<'dealt' | 'received'>('dealt');
  const [opacity, setOpacity] = useState(0.85);
  const [showReport, setShowReport] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  
  useEffect(() => {
    if (logFolder) {
      window.electronAPI.startWatching(logFolder);
    }
    
    window.electronAPI.onNewLogLines((lines) => {
      const newEvents: DamageEvent[] = [];
      for (const line of lines) {
        const ev = parseLogLine(line);
        if (ev) newEvents.push(ev);
      }
      if (newEvents.length > 0) {
        processEvents(newEvents);
      }
    });

    window.electronAPI.onLogCleared(() => {
      setEncounter(createEmptyEncounter());
    });
  }, [logFolder]);

  const processEvents = (events: DamageEvent[]) => {
    setEncounter((prev) => {
      const next = { ...prev };
      next.dealtSkills = { ...prev.dealtSkills };
      for (const k in next.dealtSkills) next.dealtSkills[k] = { ...next.dealtSkills[k], ailmentDamage: { ...next.dealtSkills[k].ailmentDamage } };
      
      next.receivedSkills = { ...prev.receivedSkills };
      for (const k in next.receivedSkills) next.receivedSkills[k] = { ...next.receivedSkills[k], ailmentDamage: { ...next.receivedSkills[k].ailmentDamage } };

      let isFirstEvent = next.startTime === 0;

      events.forEach(ev => {
        if (isFirstEvent) {
          next.startTime = ev.timeMs;
          isFirstEvent = false;
        }
        next.lastDamageTime = Math.max(next.lastDamageTime, ev.timeMs);

        const isPlayerSource = ev.source === 'Player' || ev.source.includes('Summon');
        const isPlayerTarget = ev.target === 'Player';

        // Base Damage type is used for grouping (ailments are grouped into base type in the parser logic)
        const baseType = (ev.isDot && ev.damageType === 'PHYSICAL') ? 'PHYSICAL' : (ev.isDot && ev.damageType === 'FIRE') ? 'FIRE' : ev.damageType;
        const rowKey = `${ev.source}_${ev.skillId}_${baseType}`;

        if (isPlayerSource) {
          next.totalDamageDealt += ev.value;
          if (!next.dealtSkills[rowKey]) next.dealtSkills[rowKey] = createEmptySkillRow(rowKey, ev.skillId, ev.source, baseType);
          updateSkillRow(next.dealtSkills[rowKey], ev);
        }

        if (isPlayerTarget) {
          next.totalDamageReceived += ev.value;
          // For received, we group by enemy skill
          const enemyRowKey = `${ev.source}_${ev.skillId}_${baseType}`;
          if (!next.receivedSkills[enemyRowKey]) next.receivedSkills[enemyRowKey] = createEmptySkillRow(enemyRowKey, ev.skillId, ev.source, baseType);
          updateSkillRow(next.receivedSkills[enemyRowKey], ev);
          next.lastHitReceived = ev;
        }
      });

      next.durationMs = next.lastDamageTime - next.startTime;
      if (next.durationMs <= 0) next.durationMs = 1000;

      const durationSec = next.durationMs / 1000;
      Object.values(next.dealtSkills).forEach(row => {
        row.dps = row.totalDamage / durationSec;
      });
      Object.values(next.receivedSkills).forEach(row => {
        row.dps = row.totalDamage / durationSec;
      });

      return next;
    });
  };

  const updateSkillRow = (row: SkillDamageRow, ev: DamageEvent) => {
    row.totalDamage += ev.value;
    row.totalHits += 1;
    if (ev.isCrit) row.critHits += 1;
    
    if (ev.ailment !== 'NONE') {
      row.ailmentDamage[ev.ailment] = (row.ailmentDamage[ev.ailment] || 0) + ev.value;
    }
  };

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      setLogFolder(folderPath);
      localStorage.setItem('damageLoggerFolder', folderPath);
      setEncounter(createEmptyEncounter());
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
        <div className="title-bar" style={isFixed ? { WebkitAppRegion: 'no-drag' } as any : {}}>
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

  const durationSec = (encounter.durationMs / 1000) || 0;

  return (
    <div className="app-container" style={{ '--bg-color': `rgba(15, 15, 20, ${opacity})` } as React.CSSProperties}>
      <div className="title-bar" style={isFixed ? { WebkitAppRegion: 'no-drag', cursor: 'default' } as any : {}}>
        <div className="title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Hell Clock DPS
        </div>
        <div className="window-controls">
          <button className="control-btn" onClick={() => setIsFixed(!isFixed)} title={isFixed ? "Unlock dragging" : "Lock window in place"}>
            {isFixed ? "🔒" : "🔓"}
          </button>
          <button className="control-btn" onClick={handleSelectFolder} title="Change Game Folder">⚙️</button>
          <button className="control-btn" onClick={() => window.electronAPI.windowControl('minimize')}>_</button>
          <button className="control-btn close" onClick={() => window.electronAPI.windowControl('close')}>×</button>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'dealt' ? 'active' : ''}`} 
          onClick={() => setActiveTab('dealt')}
        >
          Dealt
        </button>
        <button 
          className={`tab ${activeTab === 'received' ? 'active' : ''}`} 
          onClick={() => setActiveTab('received')}
        >
          Received
        </button>
      </div>

      <div className="content">
        <div className="encounter-header">
          <span>{durationSec.toFixed(1)}s Combat</span>
          <span>{activeTab === 'dealt' ? encounter.totalDamageDealt.toLocaleString(undefined, { maximumFractionDigits: 0 }) : encounter.totalDamageReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })} Total Dmg</span>
        </div>
        
        <DamageMeter 
          skills={activeTab === 'dealt' ? encounter.dealtSkills : encounter.receivedSkills} 
          isDealtTab={activeTab === 'dealt'}
        />
        
        {activeTab === 'received' && encounter.lastHitReceived && (
          <div style={{ padding: '8px', background: 'rgba(255, 69, 0, 0.1)', border: '1px solid rgba(255, 69, 0, 0.3)', borderRadius: '4px', marginTop: '8px', fontSize: '12px' }}>
            <div style={{ color: 'var(--color-fire)', fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>LATEST HIT RECEIVED</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '500' }}>{encounter.lastHitReceived.source} (SK: {encounter.lastHitReceived.skillId})</span>
              <span style={{ fontWeight: 'bold' }}>
                {encounter.lastHitReceived.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} 
                <span style={{ color: `var(--color-${encounter.lastHitReceived.damageType.toLowerCase()})`, fontSize: '10px', marginLeft: '6px' }}>{encounter.lastHitReceived.damageType}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="slider-container">
          <span style={{color: '#888'}}>Opacity</span>
          <input 
            type="range" 
            min="0.2" 
            max="1" 
            step="0.05" 
            value={opacity} 
            onChange={handleOpacityChange} 
          />
        </div>
        <div style={{display: 'flex', gap: 4}}>
          <button className="toolbar-btn" onClick={() => setShowReport(true)}>Report</button>
          <button className="toolbar-btn" onClick={() => setEncounter(createEmptyEncounter())}>Reset</button>
        </div>
      </div>

      {showReport && <ReportModal encounter={encounter} onClose={() => setShowReport(false)} />}
    </div>
  );
}

export default App;
