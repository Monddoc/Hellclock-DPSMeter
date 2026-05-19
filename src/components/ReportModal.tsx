import { formatNumber, escapeHtml } from '../utils';
import React from 'react';
import type { EncounterState, SkillDamageRow } from '../types';

interface Props {
  encounter: EncounterState;
  onClose: () => void;
}

export const ReportModal: React.FC<Props> = ({ encounter, onClose }) => {
  const durationSec = encounter.durationMs / 1000 || 1;

  const handleExportHtml = async () => {
    const getColorClass = (type: string) => {
      switch (type) {
        case 'PHYSICAL': return 'color-physical';
        case 'FIRE':     return 'color-fire';
        case 'LIGHTNING':return 'color-lightning';
        case 'PLAGUE':   return 'color-plague';
        default:         return 'color-unknown';
      }
    };

    const getHexForType = (type: string) => {
      switch (type) {
        case 'PHYSICAL': return '#f4c430';
        case 'FIRE':     return '#ff4500';
        case 'LIGHTNING':return '#00f0ff';
        case 'PLAGUE':   return '#39ff14';
        default:         return '#aaaaaa';
      }
    };

    // Aggregate damage by type for Graph 1
    const damageByType: Record<string, number> = {};
    Object.values(encounter.dealtSkills).forEach(row => {
      damageByType[row.damageType] = (damageByType[row.damageType] || 0) + row.totalDamage;
    });
    const maxDamageType = Math.max(...Object.values(damageByType), 1);

    // For crit/ailment graphs
    const dealtSorted = Object.values(encounter.dealtSkills).sort((a, b) => b.totalDamage - a.totalDamage);

    let html = `
      <html>
      <head>
        <title>Hell Clock Encounter Report</title>
        <style>
          :root {
            --color-physical: #f4c430;
            --color-fire: #ff4500;
            --color-lightning: #00f0ff;
            --color-plague: #39ff14;
            --color-unknown: #aaa;
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f0f14; color: #eee; padding: 40px; margin: 0; }
          .container { max-width: 1000px; margin: 0 auto; background: rgba(25,25,30,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
          h1 { color: #fff; margin-top: 0; border-bottom: 2px solid #333; padding-bottom: 10px; font-weight: 300; letter-spacing: 1px; }
          h2 { color: var(--color-fire); margin-top: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; font-weight: 400; text-transform: uppercase; letter-spacing: 1px; font-size: 1.1em; }
          .summary { display: flex; gap: 40px; margin-bottom: 20px; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 6px; }
          .summary-item { display: flex; flex-direction: column; }
          .summary-label { font-size: 0.85em; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .summary-val { font-size: 1.5em; font-weight: bold; }
          .tabs { display: flex; border-bottom: 1px solid #444; margin-bottom: 20px; }
          .tab-btn { background: none; border: none; color: #888; padding: 10px 20px; cursor: pointer; font-size: 1em; border-bottom: 3px solid transparent; transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
          .tab-btn:hover { color: #fff; }
          .tab-btn.active { color: #fff; border-bottom-color: var(--color-fire); background: rgba(255,255,255,0.05); }
          .tab-content { display: none; }
          .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
          @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.95em; }
          th { text-align: left; padding: 12px 10px; color: #888; font-weight: 500; border-bottom: 1px solid #444; font-size: 0.8em; letter-spacing: 1px; }
          td { padding: 12px 10px; border-bottom: 1px solid #222; }
          tr:hover { background: rgba(255,255,255,0.03); }
          .color-physical { color: var(--color-physical); font-weight: bold; }
          .color-fire { color: var(--color-fire); font-weight: bold; }
          .color-lightning { color: var(--color-lightning); font-weight: bold; }
          .color-plague { color: var(--color-plague); font-weight: bold; }
          .color-unknown { color: var(--color-unknown); font-weight: bold; }
          .ailment { color: #aaa; font-size: 0.85em; line-height: 1.4; }
          .numeric { text-align: right; font-family: monospace; font-size: 1.1em; }
          th.numeric { text-align: right; }
          .graph-row { display: flex; align-items: center; margin-bottom: 15px; }
          .graph-label { width: 250px; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 15px; }
          .graph-bar-container { flex: 1; background: rgba(255,255,255,0.05); height: 24px; border-radius: 4px; overflow: hidden; display: flex; position: relative; }
          .graph-bar { height: 100%; display: flex; align-items: center; padding-left: 8px; font-size: 0.8em; color: #000; font-weight: bold; font-family: monospace; transition: width 0.5s ease; }
          .graph-val { margin-left: 10px; font-family: monospace; font-size: 0.9em; color: #aaa; width: 150px; text-align: right; }
          .last-hit { padding: 15px; background: rgba(255,69,0,0.1); border: 1px solid rgba(255,69,0,0.3); border-radius: 6px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>HELL CLOCK DPS REPORT</h1>
          <div class="summary">
            <div class="summary-item"><span class="summary-label">Duration</span><span class="summary-val">${durationSec.toFixed(1)}s</span></div>
            <div class="summary-item"><span class="summary-label">Total Dealt</span><span class="summary-val">${formatNumber(encounter.totalDamageDealt)}</span></div>
            <div class="summary-item"><span class="summary-label">Total Received</span><span class="summary-val">${formatNumber(encounter.totalDamageReceived)}</span></div>
          </div>
          <div class="tabs">
            <button class="tab-btn active" onclick="openTab(event,'tab-overview')">Overview</button>
            <button class="tab-btn" onclick="openTab(event,'tab-types')">Damage Types</button>
            <button class="tab-btn" onclick="openTab(event,'tab-crits')">Crit Analysis</button>
            <button class="tab-btn" onclick="openTab(event,'tab-ailments')">Ailments</button>
          </div>

          <!-- TAB 1: OVERVIEW -->
          <div id="tab-overview" class="tab-content active">
    `;

    // Last Hit (fully escaped)
    if (encounter.lastHitReceived) {
      const lhSource = escapeHtml(encounter.lastHitReceived.source);
      const lhSkill  = escapeHtml(encounter.lastHitReceived.skillId);
      const lhType   = escapeHtml(encounter.lastHitReceived.damageType);
      const lhTypeLC = escapeHtml(encounter.lastHitReceived.damageType.toLowerCase());
      const lhName   = encounter.lastHitReceived.source === 'Player' ? lhSkill : `${lhSource} | ${lhSkill}`;
      html += `
        <div class="last-hit">
          <div style="color:var(--color-fire);font-weight:bold;margin-bottom:8px;font-size:0.85em;letter-spacing:1px;">LATEST HIT RECEIVED</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:500;font-size:1.1em;">${lhName}</span>
            <span style="font-weight:bold;font-size:1.2em;font-family:monospace;">
              ${formatNumber(encounter.lastHitReceived.value)}
              <span style="color:var(--color-${lhTypeLC});font-size:0.8em;margin-left:8px;">${lhType}</span>
            </span>
          </div>
        </div>
      `;
    }

    // addTable helper (all user fields escaped)
    const addTable = (title: string, skills: Record<string, SkillDamageRow>, isDealt: boolean = false) => {
      const sorted = Object.values(skills).sort((a, b) => b.totalDamage - a.totalDamage);
      if (sorted.length === 0) return;
      html += `<h2>${escapeHtml(title)}</h2>
        <table>
          <tr>
            ${isDealt ? '<th>SOURCE</th>' : ''}
            <th>SKILL</th><th>TYPE</th>
            <th class="numeric">HITS</th><th class="numeric">CRITS</th>
            <th class="numeric">DAMAGE</th><th class="numeric">DPS</th>
            <th>AILMENTS</th>
          </tr>`;
      sorted.forEach(row => {
        const safeSkill  = escapeHtml(row.skillId);
        const safeSource = escapeHtml(row.source);
        const safeType   = escapeHtml(row.damageType);
        const name = isDealt ? safeSkill : (row.source === 'Player' ? safeSkill : `${safeSource} | ${safeSkill}`);
        const critPct = row.totalHits > 0 ? ((row.critHits / row.totalHits) * 100).toFixed(1) : '0.0';
        const ailments = Object.entries(row.ailmentDamage)
          .filter(([_, v]) => v > 0)
          .map(([type, v]) => `${escapeHtml(type)}: ${formatNumber(v)} (${((v/row.totalDamage)*100).toFixed(1)}%)`)
          .join('<br/>');
        html += `<tr>
          ${isDealt ? `<td style="color:#aaa;font-size:0.9em;">${safeSource}</td>` : ''}
          <td style="font-weight:500;">${name}</td>
          <td class="${getColorClass(row.damageType)}" style="font-size:0.85em;">${safeType}</td>
          <td class="numeric" style="color:#ccc;">${row.totalHits}</td>
          <td class="numeric" style="color:#aaa;">${row.critHits} <span style="font-size:0.8em;color:#666;">(${critPct}%)</span></td>
          <td class="numeric" style="font-weight:bold;">${formatNumber(row.totalDamage)}</td>
          <td class="numeric" style="color:#ddd;">${formatNumber(row.dps)}</td>
          <td class="ailment">${ailments || '-'}</td>
        </tr>`;
      });
      html += `</table>`;
    };

    addTable('DAMAGE DEALT', encounter.dealtSkills, true);
    addTable('DAMAGE RECEIVED', encounter.receivedSkills, false);

    html += `</div>`; // End Tab 1

    // TAB 2: DAMAGE TYPES
    html += `<div id="tab-types" class="tab-content"><h2>DAMAGE OUTPUT BY ELEMENT</h2>`;
    Object.entries(damageByType).sort((a, b) => b[1] - a[1]).forEach(([type, val]) => {
      const pct = (val / maxDamageType) * 100;
      const overallPct = encounter.totalDamageDealt > 0 ? ((val / encounter.totalDamageDealt) * 100).toFixed(1) : '0.0';
      const hex = getHexForType(type);
      html += `
        <div class="graph-row">
          <div class="graph-label ${getColorClass(type)}">${escapeHtml(type)}</div>
          <div class="graph-bar-container"><div class="graph-bar" style="width:${pct}%;background:${hex};"></div></div>
          <div class="graph-val">${formatNumber(val)} (${overallPct}%)</div>
        </div>`;
    });
    if (Object.keys(damageByType).length === 0) html += `<p style="color:#aaa;">No damage data available.</p>`;
    html += `</div>`; // End Tab 2

    // TAB 3: CRIT ANALYSIS
    html += `<div id="tab-crits" class="tab-content"><h2>CRITICAL HIT RATES (DEALT)</h2>`;
    dealtSorted.forEach(row => {
      if (row.totalHits === 0) return;
      const name = row.source === 'Player' ? escapeHtml(row.skillId) : `${escapeHtml(row.source)} | ${escapeHtml(row.skillId)}`;
      const critPct = (row.critHits / row.totalHits) * 100;
      const nonCritPct = 100 - critPct;
      html += `
        <div class="graph-row">
          <div class="graph-label">${name}</div>
          <div class="graph-bar-container">
            <div class="graph-bar" style="width:${critPct}%;background:#ffaa00;justify-content:center;color:#000;overflow:hidden;white-space:nowrap;">${critPct >= 5 ? critPct.toFixed(1)+'% Crit' : ''}</div>
            <div class="graph-bar" style="width:${nonCritPct}%;background:rgba(255,255,255,0.1);justify-content:center;color:#aaa;overflow:hidden;white-space:nowrap;">${nonCritPct >= 5 ? nonCritPct.toFixed(1)+'% Normal' : ''}</div>
          </div>
          <div class="graph-val">${row.critHits} / ${row.totalHits}</div>
        </div>`;
    });
    html += `</div>`; // End Tab 3

    // TAB 4: AILMENTS
    html += `<div id="tab-ailments" class="tab-content"><h2>AILMENT CONTRIBUTION (BLEED / IGNITE)</h2>`;
    dealtSorted.forEach(row => {
      const bleedDmg = row.ailmentDamage['BLEED'] || 0;
      const igniteDmg = row.ailmentDamage['IGNITE'] || 0;
      const totalAilment = bleedDmg + igniteDmg;
      if (totalAilment === 0) return;
      const name = row.source === 'Player' ? escapeHtml(row.skillId) : `${escapeHtml(row.source)} | ${escapeHtml(row.skillId)}`;
      const ailmentPct = row.totalDamage > 0 ? (totalAilment / row.totalDamage) * 100 : 0;
      const nonAilmentPct = 100 - ailmentPct;
      const hex = getHexForType(row.damageType);
      html += `
        <div class="graph-row">
          <div class="graph-label">${name}</div>
          <div class="graph-bar-container">
            <div class="graph-bar" style="width:${ailmentPct}%;background:${hex};opacity:0.8;justify-content:center;overflow:hidden;white-space:nowrap;">${ailmentPct >= 5 ? ailmentPct.toFixed(1)+'% Ailment' : ''}</div>
            <div class="graph-bar" style="width:${nonAilmentPct}%;background:rgba(255,255,255,0.05);overflow:hidden;"></div>
          </div>
          <div class="graph-val">${formatNumber(totalAilment)}</div>
        </div>
        <div style="font-size:0.8em;color:#888;margin-left:265px;margin-bottom:20px;margin-top:-10px;">
          ${bleedDmg > 0 ? `<span style="color:var(--color-physical)">Bleed: ${formatNumber(bleedDmg)}</span> ` : ''}
          ${igniteDmg > 0 ? `<span style="color:var(--color-fire)">Ignite: ${formatNumber(igniteDmg)}</span>` : ''}
        </div>`;
    });
    html += `</div>`; // End Tab 4

    html += `
        </div>
        <script>
          function openTab(evt, tabId) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-content");
            for (i = 0; i < tabcontent.length; i++) { tabcontent[i].className = tabcontent[i].className.replace(" active", ""); }
            tablinks = document.getElementsByClassName("tab-btn");
            for (i = 0; i < tablinks.length; i++) { tablinks[i].className = tablinks[i].className.replace(" active", ""); }
            document.getElementById(tabId).className += " active";
            evt.currentTarget.className += " active";
          }
        </script>
      </body>
      </html>
    `;

    await window.electronAPI.exportHtml(html);
  };

  const renderStats = (skills: Record<string, SkillDamageRow>, title: string, extraHeaderNode?: React.ReactNode, isDealt?: boolean) => {
    const sorted = Object.values(skills).sort((a, b) => b.totalDamage - a.totalDamage);
    if (sorted.length === 0) return <p style={{ color: '#aaa' }}>No data for {title.toLowerCase()}.</p>;

    return (
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: 'var(--color-fire)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
          {title}
        </h3>
        {extraHeaderNode}
        {sorted.map(row => {
          const displayName = isDealt ? row.skillId : (row.source === 'Player' ? row.skillId : `${row.source} | ${row.skillId}`);
          const critPercent = row.totalHits > 0 ? ((row.critHits / row.totalHits) * 100).toFixed(1) : '0.0';

          return (
            <div key={row.key} style={{ marginBottom: 15, background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>
                  {isDealt && <span style={{ color: '#aaa', fontWeight: 'normal', marginRight: 8 }}>{row.source}</span>}
                  {displayName} <span style={{fontSize: 12, color: '#aaa', marginLeft: 8}}>{row.damageType}</span>
                </strong>
                <span>{formatNumber(row.totalDamage)} Dmg | {formatNumber(row.dps)} DPS</span>
              </div>

              <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#ccc' }}>
                <div style={{ flex: 1 }}>
                  <div><strong>Hits:</strong> {row.totalHits}</div>
                  <div><strong>Crits:</strong> {row.critHits} ({critPercent}%)</div>
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#aaa' }}>Ailment Contribution</strong>
                  {Object.entries(row.ailmentDamage)
                    .filter(([_, val]) => val > 0)
                    .map(([type, val]) => (
                      <div key={type} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{type}</span>
                        <span>{formatNumber(val)} ({((val / row.totalDamage) * 100).toFixed(1)}%)</span>
                      </div>
                    ))}
                  {Object.values(row.ailmentDamage).every(v => v === 0) && (
                    <div style={{ color: '#666' }}>No ailment damage.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2>Encounter Report</h2>
            <button className="primary-btn" style={{ padding: '6px 12px', marginTop: 0, fontSize: '12px' }} onClick={handleExportHtml}>
              Export HTML
            </button>
          </div>
          <button className="control-btn close" onClick={onClose} style={{ fontSize: '20px' }}>×</button>
        </div>
        <div style={{ marginBottom: 15, fontSize: 14, color: '#ccc' }}>
          <strong>Duration:</strong> {durationSec.toFixed(1)}s<br/>
          <strong>Total Dealt:</strong> {formatNumber(encounter.totalDamageDealt)}<br/>
          <strong>Total Received:</strong> {formatNumber(encounter.totalDamageReceived)}
        </div>

        {renderStats(encounter.dealtSkills, 'Damage Dealt', undefined, true)}

        {renderStats(encounter.receivedSkills, 'Damage Received', encounter.lastHitReceived ? (
          <div style={{ padding: '12px', background: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)', borderRadius: '4px', marginBottom: '15px', marginTop: '10px' }}>
            <div style={{ color: 'var(--color-fire)', fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>LATEST HIT RECEIVED (POSSIBLE DEATH CAUSE)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '500' }}>{encounter.lastHitReceived.source === 'Player' ? encounter.lastHitReceived.skillId : `${encounter.lastHitReceived.source} | ${encounter.lastHitReceived.skillId}`}</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                {formatNumber(encounter.lastHitReceived.value)}
                <span style={{ color: `var(--color-${encounter.lastHitReceived.damageType.toLowerCase()})`, fontSize: '12px', marginLeft: '6px' }}>{encounter.lastHitReceived.damageType}</span>
              </span>
            </div>
          </div>
        ) : undefined)}

      </div>
    </div>
  );
};
