import { formatNumber, escapeHtml } from '../utils';
import React from 'react';
import type { EncounterState, SkillDamageRow } from '../types';

interface Props {
  encounter: EncounterState;
  onClose: () => void;
}

export const ReportModal: React.FC<Props> = ({ encounter, onClose }) => {
  const activeSec = Math.max(encounter.activeDurationMs, 1000) / 1000;

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

    const getProgressHexForType = (type: string, label?: string, nodeId?: string) => {
      const isBleed = type === 'PHYSICAL' && (
        (label && (label.toLowerCase().includes('bleed') || label.toLowerCase().includes('bleeding'))) ||
        (nodeId && (nodeId.toLowerCase().includes('bleed') || nodeId.toLowerCase().includes('bleeding')))
      );
      if (isBleed) {
        return '#ff1a1a';
      }
      switch (type) {
        case 'PHYSICAL': return '#f4c430';
        case 'FIRE':     return '#ff4500';
        case 'LIGHTNING':return '#00f0ff';
        case 'PLAGUE':   return '#39ff14';
        default:         return '#aaaaaa';
      }
    };

    const hexToRgba = (hex: string, alpha: number) => {
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Helper: Build tree structure for HTML report
    const buildTreeData = (skills: Record<string, SkillDamageRow>) => {
      const flatRows = Object.values(skills);
      if (flatRows.length === 0) return [];

      const level1Groups: Record<string, SkillDamageRow[]> = {};
      flatRows.forEach(row => {
        const sk = row.skillKey || 'Unknown Skill';
        if (!level1Groups[sk]) level1Groups[sk] = [];
        level1Groups[sk].push(row);
      });

      interface ReportTreeNode {
        id: string;
        parentId: string | null;
        label: string;
        sourceLabel: string;
        depth: number;
        hasChildren: boolean;
        children: ReportTreeNode[];
        skillId: string;
        damageType: string;
        totalDamage: number;
        dps: number;
        peakDps: number;
        maxHit: number;
        totalHits: number;
        critHits: number;
        ailmentDamage: Record<string, number>;
      }

      const rootNodes: ReportTreeNode[] = [];

      Object.entries(level1Groups).forEach(([skillKey, l1Rows]) => {
        const l1PeakDps = encounter.peakDpsBySkillKey[skillKey] || 0;

        // Single-row flattening bypass (Summon Brute Consolidation)
        if (l1Rows.length === 1) {
          const row = l1Rows[0];
          rootNodes.push({
            id: skillKey,
            parentId: null,
            label: skillKey,
            sourceLabel: row.source,
            depth: 0,
            hasChildren: false,
            children: [],
            skillId: row.skillId,
            damageType: row.damageType,
            totalDamage: row.totalDamage,
            dps: row.dps,
            peakDps: row.peakDps || l1PeakDps,
            maxHit: row.maxHit,
            totalHits: row.totalHits,
            critHits: row.critHits,
            ailmentDamage: row.ailmentDamage,
          });
          return;
        }

        const level2Groups: Record<string, SkillDamageRow[]> = {};
        l1Rows.forEach(row => {
          const src = row.source || 'Player';
          if (!level2Groups[src]) level2Groups[src] = [];
          level2Groups[src].push(row);
        });

        const l1Children: ReportTreeNode[] = [];
        let l1TotalDamage = 0;
        let l1TotalHits = 0;
        let l1CritHits = 0;
        let l1MaxHit = 0;
        let l1Dps = 0;
        const l1TypeDamage: Record<string, number> = {};
        const l1AilmentDamage: Record<string, number> = {};

        Object.entries(level2Groups).forEach(([sourceName, l2Rows]) => {
          const l2Children: ReportTreeNode[] = [];
          let l2TotalDamage = 0;
          let l2TotalHits = 0;
          let l2CritHits = 0;
          let l2MaxHit = 0;
          let l2Dps = 0;
          const l2TypeDamage: Record<string, number> = {};
          const l2AilmentDamage: Record<string, number> = {};

          l2Rows.forEach(row => {
            l2TotalDamage += row.totalDamage;
            l2TotalHits += row.totalHits;
            l2CritHits += row.critHits;
            if (row.maxHit > l2MaxHit) l2MaxHit = row.maxHit;
            l2Dps += row.dps;
            l2TypeDamage[row.damageType] = (l2TypeDamage[row.damageType] || 0) + row.totalDamage;
            Object.entries(row.ailmentDamage).forEach(([type, val]) => {
              l2AilmentDamage[type] = (l2AilmentDamage[type] || 0) + val;
            });

            const l3Id = `${skillKey}||${sourceName}||${row.skillName}`;
            l2Children.push({
              id: l3Id,
              parentId: `${skillKey}||${sourceName}`,
              label: row.skillName,
              sourceLabel: row.source,
              depth: 2,
              hasChildren: false,
              children: [],
              skillId: row.skillId,
              damageType: row.damageType,
              totalDamage: row.totalDamage,
              dps: row.dps,
              peakDps: row.peakDps,
              maxHit: row.maxHit,
              totalHits: row.totalHits,
              critHits: row.critHits,
              ailmentDamage: row.ailmentDamage,
            });
          });

          l1TotalDamage += l2TotalDamage;
          l1TotalHits += l2TotalHits;
          l1CritHits += l2CritHits;
          if (l2MaxHit > l1MaxHit) l1MaxHit = l2MaxHit;
          l1Dps += l2Dps;
          Object.entries(l2TypeDamage).forEach(([type, val]) => {
            l1TypeDamage[type] = (l1TypeDamage[type] || 0) + val;
          });
          Object.entries(l2AilmentDamage).forEach(([type, val]) => {
            l1AilmentDamage[type] = (l1AilmentDamage[type] || 0) + val;
          });

          let l2DominantType = 'UNKNOWN';
          let maxL2TypeVal = -1;
          Object.entries(l2TypeDamage).forEach(([type, val]) => {
            if (val > maxL2TypeVal) {
              maxL2TypeVal = val;
              l2DominantType = type;
            }
          });

          const l2Id = `${skillKey}||${sourceName}`;
          const l2PeakDps = encounter.peakDpsBySourceSkillKey[l2Id] || Math.max(...l2Children.map(c => c.peakDps), 0);

          l1Children.push({
            id: l2Id,
            parentId: skillKey,
            label: sourceName,
            sourceLabel: sourceName,
            depth: 1,
            hasChildren: true,
            children: l2Children.sort((a, b) => b.totalDamage - a.totalDamage),
            skillId: '',
            damageType: l2DominantType,
            totalDamage: l2TotalDamage,
            dps: l2Dps,
            peakDps: l2PeakDps,
            maxHit: l2MaxHit,
            totalHits: l2TotalHits,
            critHits: l2CritHits,
            ailmentDamage: l2AilmentDamage,
          });
        });

        let l1DominantType = 'UNKNOWN';
        let maxL1TypeVal = -1;
        Object.entries(l1TypeDamage).forEach(([type, val]) => {
          if (val > maxL1TypeVal) {
            maxL1TypeVal = val;
            l1DominantType = type;
          }
        });

        rootNodes.push({
          id: skillKey,
          parentId: null,
          label: skillKey,
          sourceLabel: '',
          depth: 0,
          hasChildren: true,
          children: l1Children.sort((a, b) => b.totalDamage - a.totalDamage),
          skillId: '',
          damageType: l1DominantType,
          totalDamage: l1TotalDamage,
          dps: l1Dps,
          peakDps: l1PeakDps,
          maxHit: l1MaxHit,
          totalHits: l1TotalHits,
          critHits: l1CritHits,
          ailmentDamage: l1AilmentDamage,
        });
      });

      return rootNodes.sort((a, b) => b.totalDamage - a.totalDamage);
    };

    // Helper: Recursively render HTML table rows
    const renderTreeToHtmlRows = (nodes: any[], maxTableDamage: number): string => {
      let rowsHtml = '';
      nodes.forEach(node => {
        const isParent = node.hasChildren;
        const safeSkillName = escapeHtml(node.label);
        const safeSid = escapeHtml(node.skillId);
        const safeSource = escapeHtml(node.sourceLabel);
        const safeType = escapeHtml(node.damageType);
        const critPct = node.totalHits > 0 ? ((node.critHits / node.totalHits) * 100).toFixed(1) : '0.0';
        const ailments = Object.entries(node.ailmentDamage)
          .filter(([_, v]) => (v as number) > 0)
          .map(([type, v]) => `${escapeHtml(type)}: ${formatNumber(v as number)} (${(((v as number)/node.totalDamage)*100).toFixed(1)}%)`)
          .join('<br/>');

        const indentPadding = node.depth * 18;
        const arrowSpan = isParent 
          ? `<span class="tree-arrow">▶</span>`
          : `<span style="display:inline-block;width:16px;"></span>`;

        const rowClass = `tree-row depth-${node.depth} ${isParent ? 'parent-row' : 'leaf-row'}`;
        const rowStyle = node.depth > 0 ? `display:none;` : ``;
        const dataParentAttr = node.parentId ? `data-parent="${escapeHtml(node.parentId)}"` : '';
        const dataIdAttr = `data-id="${escapeHtml(node.id)}"`;

        // Calculate progress bar percentage and colors
        const pct = ((node.totalDamage / maxTableDamage) * 100).toFixed(1);
        const barColor = getProgressHexForType(node.damageType, node.label, node.id);
        const barAlpha = node.depth === 0 ? 0.25 : node.depth === 1 ? 0.15 : 0.08;
        const rgbaColor = hexToRgba(barColor, barAlpha);

        let baseBg = 'transparent';
        if (node.depth === 0) baseBg = 'rgba(255, 255, 255, 0.04)';
        else if (node.depth === 1) baseBg = 'rgba(255, 255, 255, 0.01)';

        const backgroundStyle = `background: linear-gradient(90deg, ${rgbaColor} ${pct}%, ${baseBg} ${pct}%);`;

        let nodeColor = '';
        if (node.depth === 0) {
          nodeColor = '#ffddaa';
        } else if (node.depth === 1) {
          nodeColor = '#e0e0e0';
        } else {
          nodeColor = getHexForType(node.damageType);
        }

        rowsHtml += `
          <tr class="${rowClass}" ${dataIdAttr} ${dataParentAttr} style="${rowStyle}${backgroundStyle}" ${isParent ? `onclick="toggleTreeRow('${escapeHtml(node.id)}')"` : ''}>
            <td style="padding-left:${indentPadding + 10}px; font-weight:${node.depth === 0 ? 'bold' : 'normal'}; color:${nodeColor};">
              ${arrowSpan}${safeSkillName}
            </td>
            <td style="color:#aaa;font-size:0.9em;">${safeSource || '-'}</td>
            <td style="color:#666;font-size:0.85em;text-align:center;">${safeSid || '-'}</td>
            <td class="${getColorClass(node.damageType)}" style="font-size:0.85em;">${safeType}</td>
            <td class="numeric" style="color:#ccc;">${node.totalHits}</td>
            <td class="numeric" style="color:#aaa;">${node.critHits} <span style="font-size:0.8em;color:#666;">(${critPct}%)</span></td>
            <td class="numeric" style="color:#ffcc00;font-weight:500;">${node.maxHit > 0 ? formatNumber(node.maxHit) : '-'}</td>
            <td class="numeric" style="font-weight:bold;">${formatNumber(node.totalDamage)}</td>
            <td class="numeric" style="color:#ddd;">${formatNumber(node.dps)}</td>
            <td class="numeric peak">⚡ ${formatNumber(node.peakDps)}</td>
            <td class="ailment">${ailments || '-'}</td>
          </tr>
        `;

        if (node.children && node.children.length > 0) {
          rowsHtml += renderTreeToHtmlRows(node.children, maxTableDamage);
        }
      });
      return rowsHtml;
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
        <title>Hell Clock Encounter Details</title>
        <style>
          :root {
            --color-physical: #f4c430;
            --color-bleed: #ff1a1a;
            --color-fire: #ff4500;
            --color-lightning: #00f0ff;
            --color-plague: #39ff14;
            --color-unknown: #aaa;
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f0f14; color: #eee; padding: 40px; margin: 0; }
          .container { max-width: 1000px; margin: 0 auto; background: rgba(25,25,30,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
          h1 { color: #fff; margin-top: 0; border-bottom: 2px solid #333; padding-bottom: 10px; font-weight: 300; letter-spacing: 1px; }
          h2 { color: var(--color-fire); margin-top: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; font-weight: 400; text-transform: uppercase; letter-spacing: 1px; font-size: 1.1em; }
          .summary { display: flex; gap: 40px; margin-bottom: 20px; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 6px; flex-wrap: wrap; }
          .summary-item { display: flex; flex-direction: column; }
          .summary-label { font-size: 0.85em; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .summary-val { font-size: 1.5em; font-weight: bold; }
          .summary-val.peak { color: #ff9944; }
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
          .color-physical { color: var(--color-physical); font-weight: bold; }
          .color-bleed { color: var(--color-bleed); font-weight: bold; }
          .color-fire { color: var(--color-fire); font-weight: bold; }
          .color-lightning { color: var(--color-lightning); font-weight: bold; }
          .color-plague { color: var(--color-plague); font-weight: bold; }
          .color-unknown { color: var(--color-unknown); font-weight: bold; }
          .ailment { color: #aaa; font-size: 0.85em; line-height: 1.4; }
          .numeric { text-align: right; font-family: monospace; font-size: 1.1em; }
          th.numeric { text-align: right; }
          .peak { color: #ff9944; font-size: 0.85em; }
          .graph-row { display: flex; align-items: center; margin-bottom: 15px; }
          .graph-label { width: 250px; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 15px; }
          .graph-bar-container { flex: 1; background: rgba(255,255,255,0.05); height: 24px; border-radius: 4px; overflow: hidden; display: flex; position: relative; }
          .graph-bar { height: 100%; display: flex; align-items: center; padding-left: 8px; font-size: 0.8em; color: #000; font-weight: bold; font-family: monospace; transition: width 0.5s ease; }
          .graph-val { margin-left: 10px; font-family: monospace; font-size: 0.9em; color: #aaa; width: 150px; text-align: right; }
          .last-hit { padding: 15px; background: rgba(255,69,0,0.1); border: 1px solid rgba(255,69,0,0.3); border-radius: 6px; margin-bottom: 20px; }
          
          /* Custom Tree styling */
          .html-toolbar-btn {
            background: none;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #ccc;
            padding: 4px 8px;
            font-size: 11px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .html-toolbar-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.4);
          }
          .tree-row { cursor: pointer; transition: background 0.15s ease-in-out; }
          .tree-row:hover { background: rgba(255, 255, 255, 0.05) !important; }
          .tree-row.depth-0 { background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
          .tree-row.depth-1 { background: rgba(255, 255, 255, 0.01); }
          .tree-row.depth-2 { background: transparent; cursor: default; }
          .tree-arrow { display: inline-block; margin-right: 6px; transition: transform 0.2s; transform: rotate(0deg); color: #bbb; font-size: 0.85em; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>HELL CLOCK DAMAGE BREAKDOWN</h1>
          <div class="summary">
            <div class="summary-item"><span class="summary-label">Active Combat</span><span class="summary-val">${activeSec.toFixed(1)}s</span></div>
            <div class="summary-item"><span class="summary-label">Total Dealt</span><span class="summary-val">${formatNumber(encounter.totalDamageDealt)}</span></div>
            <div class="summary-item"><span class="summary-label">Total Received</span><span class="summary-val">${formatNumber(encounter.totalDamageReceived)}</span></div>
            <div class="summary-item"><span class="summary-label">Peak DPS (Dealt)</span><span class="summary-val peak">⚡ ${formatNumber(encounter.peakDpsDealt)}</span></div>
            <div class="summary-item"><span class="summary-label">Peak DPS (Received)</span><span class="summary-val peak">⚡ ${formatNumber(encounter.peakDpsReceived)}</span></div>
          </div>
          <div class="tabs">
            <button class="tab-btn active" onclick="openTab(event,'tab-overview')">Overview</button>
            <button class="tab-btn" onclick="openTab(event,'tab-types')">Damage Types</button>
            <button class="tab-btn" onclick="event.preventDefault(); openTab(event,'tab-crits')">Crit Analysis</button>
            <button class="tab-btn" onclick="event.preventDefault(); openTab(event,'tab-ailments')">Ailments</button>
          </div>

          <!-- TAB 1: OVERVIEW -->
          <div id="tab-overview" class="tab-content active">
    `;

    // Last Hit (fully escaped)
    if (encounter.lastHitReceived) {
      const lhSource = escapeHtml(encounter.lastHitReceived.source);
      const lhSkillName = escapeHtml(encounter.lastHitReceived.skillName);
      const lhSid    = escapeHtml(encounter.lastHitReceived.skillId);
      const lhType   = escapeHtml(encounter.lastHitReceived.damageType);
      const lhTypeLC = escapeHtml(encounter.lastHitReceived.damageType.toLowerCase());
      html += `
        <div class="last-hit">
          <div style="color:var(--color-fire);font-weight:bold;margin-bottom:8px;font-size:0.85em;letter-spacing:1px;">LATEST HIT RECEIVED</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:500;font-size:1.1em;">${lhSource} — ${lhSkillName} <span style="color:#666;font-size:0.75em;">SID:${lhSid}</span></span>
            <span style="font-weight:bold;font-size:1.2em;font-family:monospace;">
              ${formatNumber(encounter.lastHitReceived.value)}
              <span style="color:var(--color-${lhTypeLC});font-size:0.8em;margin-left:8px;">${lhType}</span>
            </span>
          </div>
        </div>
      `;
    }

    // addTable helper (all user fields escaped)
    const addTable = (title: string, skills: Record<string, SkillDamageRow>) => {
      const treeNodes = buildTreeData(skills);
      if (treeNodes.length === 0) return;

      const maxTableDamage = Math.max(treeNodes[0].totalDamage, 1);
      const slugifiedTitle = title.toLowerCase().replace(/\s+/g, '-');
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
          <h2 style="margin:0; border:none; padding:0; color:var(--color-fire); text-transform:uppercase; letter-spacing:1px; font-size:1.1em; font-weight:400;">${escapeHtml(title)}</h2>
          <div style="display: flex; gap: 8px;">
            <button class="html-toolbar-btn" onclick="collapseTableRows('${slugifiedTitle}')">Collapse All</button>
            <button class="html-toolbar-btn" onclick="expandTableRows('${slugifiedTitle}')">Expand All</button>
          </div>
        </div>
        <table id="table-${slugifiedTitle}">
          <tr>
            <th>SKILL</th>
            <th>SOURCE</th>
            <th>SID</th>
            <th>TYPE</th>
            <th class="numeric">HITS</th>
            <th class="numeric">CRITS</th>
            <th class="numeric">MAX HIT</th>
            <th class="numeric">DAMAGE</th>
            <th class="numeric">DPS</th>
            <th class="numeric">PEAK DPS</th>
            <th>AILMENTS</th>
          </tr>
          ${renderTreeToHtmlRows(treeNodes, maxTableDamage)}
        </table>
      `;
    };

    addTable('DAMAGE DEALT', encounter.dealtSkills);
    addTable('DAMAGE RECEIVED', encounter.receivedSkills);

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
      const name = escapeHtml(row.skillName);
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
    const bleedPct = Math.min(100, (encounter.bleedUptimeMs / Math.max(encounter.activeDurationMs, 1)) * 100);
    const ignitePct = Math.min(100, (encounter.igniteUptimeMs / Math.max(encounter.activeDurationMs, 1)) * 100);
    html += `<div id="tab-ailments" class="tab-content">
      <h2>COMBAT AILMENT UPTIMES</h2>
      <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:20px; margin-bottom:30px;">
        ${encounter.bleedUptimeMs > 0 ? `
          <div class="graph-row" style="margin-bottom:15px;">
            <div class="graph-label" style="font-weight:bold;color:#e0e0e0;">Bleed Uptime</div>
            <div class="graph-bar-container" style="background:rgba(255,255,255,0.05);height:20px;">
              <div class="graph-bar" style="width:${bleedPct.toFixed(1)}%;background:#ff1a1a;color:#fff;"></div>
            </div>
            <div class="graph-val" style="font-weight:bold;font-size:1.1em;color:#ff1a1a;">${bleedPct.toFixed(1)}%</div>
          </div>
        ` : ''}
        ${encounter.igniteUptimeMs > 0 ? `
          <div class="graph-row" style="margin-bottom:15px;">
            <div class="graph-label" style="font-weight:bold;color:#e0e0e0;">Ignite Uptime</div>
            <div class="graph-bar-container" style="background:rgba(255,255,255,0.05);height:20px;">
              <div class="graph-bar" style="width:${ignitePct.toFixed(1)}%;background:#ff4500;color:#fff;"></div>
            </div>
            <div class="graph-val" style="font-weight:bold;font-size:1.1em;color:#ff4500;">${ignitePct.toFixed(1)}%</div>
          </div>
        ` : ''}
        ${encounter.bleedUptimeMs === 0 && encounter.igniteUptimeMs === 0 ? `
          <p style="color:#888;margin:0;">No active ailments (Bleed/Ignite) recorded during this encounter.</p>
        ` : ''}
      </div>
      <h2>AILMENT DAMAGE CONTRIBUTION</h2>`;
    dealtSorted.forEach(row => {
      const bleedDmg = row.ailmentDamage['BLEED'] || 0;
      const igniteDmg = row.ailmentDamage['IGNITE'] || 0;
      const totalAilment = bleedDmg + igniteDmg;
      if (totalAilment === 0) return;
      const name = escapeHtml(row.skillName);
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

          function toggleTreeRow(nodeId) {
            var parentRow = document.querySelector('tr[data-id="' + nodeId + '"]');
            if (!parentRow) return;

            var arrow = parentRow.querySelector('.tree-arrow');
            var isExpanded = arrow && arrow.style.transform === 'rotate(90deg)';

            if (isExpanded) {
              if (arrow) arrow.style.transform = 'rotate(0deg)';
              hideDescendants(nodeId);
            } else {
              if (arrow) arrow.style.transform = 'rotate(90deg)';
              showDirectChildren(nodeId);
            }
          }

          function hideDescendants(parentId) {
            var children = document.querySelectorAll('tr[data-parent="' + parentId + '"]');
            for (var i = 0; i < children.length; i++) {
              var child = children[i];
              child.style.display = 'none';
              var arrow = child.querySelector('.tree-arrow');
              if (arrow) arrow.style.transform = 'rotate(0deg)';
              var childId = child.getAttribute('data-id');
              if (childId) {
                hideDescendants(childId);
              }
            }
          }

          function showDirectChildren(parentId) {
            var children = document.querySelectorAll('tr[data-parent="' + parentId + '"]');
            for (var i = 0; i < children.length; i++) {
              var child = children[i];
              child.style.display = 'table-row';
            }
          }

          function collapseTableRows(tableTitle) {
            var tableId = 'table-' + tableTitle.replace(/\\s+/g, '-');
            var table = document.getElementById(tableId);
            if (!table) return;

            var parentRows = table.querySelectorAll('tr.parent-row');
            for (var i = 0; i < parentRows.length; i++) {
              var arrow = parentRows[i].querySelector('.tree-arrow');
              if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
            
            var allDescendants = table.querySelectorAll('tr.depth-1, tr.depth-2');
            for (var i = 0; i < allDescendants.length; i++) {
              allDescendants[i].style.display = 'none';
            }
          }

          function expandTableRows(tableTitle) {
            var tableId = 'table-' + tableTitle.replace(/\\s+/g, '-');
            var table = document.getElementById(tableId);
            if (!table) return;

            var parentRows = table.querySelectorAll('tr.parent-row');
            for (var i = 0; i < parentRows.length; i++) {
              var arrow = parentRows[i].querySelector('.tree-arrow');
              if (arrow) arrow.style.transform = 'rotate(90deg)';
            }

            var allRows = table.querySelectorAll('tr.depth-1, tr.depth-2');
            for (var i = 0; i < allRows.length; i++) {
              allRows[i].style.display = 'table-row';
            }
          }
        </script>
      </body>
      </html>
    `;

    await window.electronAPI.exportHtml(html);
  };

  const renderStats = (skills: Record<string, SkillDamageRow>, title: string, extraHeaderNode?: React.ReactNode) => {
    const sorted = Object.values(skills).sort((a, b) => b.totalDamage - a.totalDamage);
    if (sorted.length === 0) return <p style={{ color: '#aaa', fontSize: '13px' }}>No data for {title.toLowerCase()}.</p>;

    return (
      <div style={{ marginBottom: 25 }}>
        <h3 style={{ color: 'var(--color-fire)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          {title}
        </h3>
        {extraHeaderNode}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '6px 12px' }}>
          {sorted.map(row => {
            const displayName = row.skillName;
            return (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <span style={{ color: '#888', minWidth: '70px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{row.source}</span>
                  <span style={{ fontWeight: '600', color: '#ffddaa', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{displayName}</span>
                  <span style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>SID:{row.skillId}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{formatNumber(row.totalDamage)} <span style={{ fontWeight: 'normal', color: '#aaa', fontSize: '11px' }}>Dmg</span></span>
                  <span style={{ color: '#ccc' }}>{formatNumber(row.dps)} <span style={{ color: '#888', fontSize: '11px' }}>DPS</span></span>
                  {row.maxHit > 0 && (
                    <span style={{ color: '#ffcc00', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      💥 <span style={{ fontWeight: '500' }}>{formatNumber(row.maxHit)}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2>Encounter Details</h2>
            <button className="primary-btn" style={{ padding: '6px 12px', marginTop: 0, fontSize: '12px' }} onClick={handleExportHtml}>
              Export HTML
            </button>
          </div>
          <button className="control-btn close" onClick={onClose} style={{ fontSize: '20px' }}>×</button>
        </div>

        <div style={{
          background: 'rgba(255, 153, 68, 0.08)',
          border: '1px solid rgba(255, 153, 68, 0.25)',
          borderRadius: '6px',
          padding: '10px 14px',
          marginBottom: '15px',
          fontSize: '12.5px',
          color: '#eee',
          lineHeight: '1.4'
        }}>
          💡 <strong>Tip:</strong> This in-game view is a minimalist summary. Click the <strong>"Export HTML"</strong> button at the top to save and view an extremely detailed, interactive breakdown featuring full collapsible tree grids, critical rates, detailed ailment contributions, and graphical elemental analyses!
        </div>

        <div style={{ marginBottom: 15, fontSize: 14, color: '#ccc' }}>
          <strong>Active Combat:</strong> {activeSec.toFixed(1)}s<br/>
          <strong>Total Dealt:</strong> {formatNumber(encounter.totalDamageDealt)}
          <span style={{ color: '#ff9944', marginLeft: 12 }}>⚡ {formatNumber(encounter.peakDpsDealt)} Peak DPS</span><br/>
          <strong>Total Received:</strong> {formatNumber(encounter.totalDamageReceived)}
          <span style={{ color: '#ff9944', marginLeft: 12 }}>⚡ {formatNumber(encounter.peakDpsReceived)} Peak DPS</span>
        </div>

        {/* Combat Ailment Uptimes */}
        {(encounter.bleedUptimeMs > 0 || encounter.igniteUptimeMs > 0) && (
          <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#ff9944', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Combat Ailment Uptimes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {encounter.bleedUptimeMs > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '80px', fontSize: '11.5px', color: '#e0e0e0' }}>Bleed</span>
                  <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (encounter.bleedUptimeMs / Math.max(encounter.activeDurationMs, 1)) * 100).toFixed(1)}%`, background: '#ff1a1a', transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ width: '45px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}>{Math.min(100, (encounter.bleedUptimeMs / Math.max(encounter.activeDurationMs, 1)) * 100).toFixed(1)}%</span>
                </div>
              )}
              {encounter.igniteUptimeMs > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '80px', fontSize: '11.5px', color: '#e0e0e0' }}>Ignite</span>
                  <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (encounter.igniteUptimeMs / Math.max(encounter.activeDurationMs, 1)) * 100).toFixed(1)}%`, background: '#ff4500', transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ width: '45px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}>{Math.min(100, (encounter.igniteUptimeMs / Math.max(encounter.activeDurationMs, 1)) * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {renderStats(encounter.dealtSkills, 'Damage Dealt')}

        {renderStats(encounter.receivedSkills, 'Damage Received', encounter.lastHitReceived ? (
          <div style={{ padding: '12px', background: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)', borderRadius: '4px', marginBottom: '15px', marginTop: '10px' }}>
            <div style={{ color: 'var(--color-fire)', fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>LATEST HIT RECEIVED (POSSIBLE DEATH CAUSE)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '500' }}>{encounter.lastHitReceived.source} — {encounter.lastHitReceived.skillName} <span style={{ color: '#666', fontSize: '10px' }}>SID:{encounter.lastHitReceived.skillId}</span></span>
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
