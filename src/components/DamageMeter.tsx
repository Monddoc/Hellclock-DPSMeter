import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { EncounterState, SkillDamageRow } from '../types';
import { formatNumber } from '../utils';

const COL_WIDTHS_KEY = 'hellclock_col_widths';
const COL_VISIBILITY_KEY = 'hellclock_col_visibility';

export type ColumnId = 'source' | 'skill' | 'sid' | 'type' | 'hits' | 'maxHit' | 'damage';

export const COLUMN_LABELS: Record<ColumnId, string> = {
  source: 'Source',
  skill: 'Skill',
  sid: 'SID',
  type: 'Type',
  hits: 'Hits',
  maxHit: 'Max Hit',
  damage: 'Damage / DPS',
};

/** All columns in display order */
export const ALL_COLUMNS: ColumnId[] = ['skill', 'source', 'sid', 'type', 'hits', 'maxHit', 'damage'];

const DEFAULT_WIDTHS: Record<ColumnId, number> = {
  source: 100,
  skill: 130,
  sid: 60,
  type: 80,
  hits: 60,
  maxHit: 75,
  damage: 100,
};

const DEFAULT_VISIBILITY: Record<ColumnId, boolean> = {
  source: true,
  skill: true,
  sid: false,
  type: true,
  hits: true,
  maxHit: true,
  damage: true,
};

function loadColWidths(): Record<ColumnId, number> {
  try {
    const saved = localStorage.getItem(COL_WIDTHS_KEY);
    if (saved) return { ...DEFAULT_WIDTHS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_WIDTHS };
}

export function loadColVisibility(): Record<ColumnId, boolean> {
  try {
    const saved = localStorage.getItem(COL_VISIBILITY_KEY);
    if (saved) return { ...DEFAULT_VISIBILITY, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VISIBILITY };
}

export function saveColVisibility(vis: Record<ColumnId, boolean>): void {
  localStorage.setItem(COL_VISIBILITY_KEY, JSON.stringify(vis));
}

interface ResizerProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

const Resizer: React.FC<ResizerProps> = ({ onMouseDown }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: 'col-resize',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: hovered ? '2px' : '1px',
          height: '100%',
          backgroundColor: hovered ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)',
          transition: 'all 0.15s ease',
        }}
      />
    </div>
  );
};

interface Props {
  encounter: EncounterState;
  activeTab: 'dealt' | 'received';
  primaryMetric: 'total' | 'dps';
  columnVisibility: Record<ColumnId, boolean>;
}

interface TreeGridNode {
  key: string;       // Unique node identifier
  label: string;     // Primary skill column text
  sourceLabel: string; // Source column text
  depth: number;     // 0 = Level 1 (Skill Key), 1 = Level 2 (Source), 2 = Level 3 (Subskill)
  hasChildren: boolean;
  isExpanded: boolean;
  children: TreeGridNode[];
  
  // Aggregated damage metrics
  skillId: string;
  damageType: string;
  totalDamage: number;
  dps: number;
  peakDps: number;
  maxHit: number;
  totalHits: number;
  critHits: number;
}

export interface DamageMeterRef {
  toggleCollapseExpandAll: () => void;
}

export const DamageMeter = React.forwardRef<DamageMeterRef, Props>(
  ({ encounter, activeTab, primaryMetric, columnVisibility }, ref) => {
    const [colWidths, setColWidths] = useState(loadColWidths);
    const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
    const [sortField, setSortField] = useState<ColumnId>('damage');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Persist column widths whenever they change
    useEffect(() => {
      localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths));
    }, [colWidths]);

    const handleHeaderClick = (field: ColumnId) => {
      if (sortField === field) {
        setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
    };

    const renderHeader = (colId: ColumnId, label: string) => {
      const isSorted = sortField === colId;
      
      return (
        <div
          onClick={() => handleHeaderClick(colId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px',
            cursor: 'pointer',
            width: '100%',
            height: '100%',
            userSelect: 'none',
          }}
        >
          <span>{label}</span>
          {isSorted ? (
            <span style={{ fontSize: '9px', color: '#ff9944' }}>
              {sortOrder === 'asc' ? '▲' : '▼'}
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.55)', marginLeft: '2px' }}>
              ⇅
            </span>
          )}
        </div>
      );
    };

  const toggleExpand = useCallback((nodeKey: string) => {
    setExpandedKeys(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey],
    }));
  }, []);

  const getColorForType = (type: string, label?: string, nodeKey?: string) => {
    const isBleed = type === 'PHYSICAL' && (
      (label && (label.toLowerCase().includes('bleed') || label.toLowerCase().includes('bleeding'))) ||
      (nodeKey && (nodeKey.toLowerCase().includes('bleed') || nodeKey.toLowerCase().includes('bleeding')))
    );
    if (isBleed) {
      return 'var(--color-bleed)';
    }
    switch (type) {
      case 'PHYSICAL': return 'var(--color-physical)';
      case 'FIRE':     return 'var(--color-fire)';
      case 'LIGHTNING':return 'var(--color-lightning)';
      case 'PLAGUE':   return 'var(--color-plague)';
      default:         return 'var(--color-unknown)';
    }
  };

  const skills = activeTab === 'dealt' ? encounter.dealtSkills : encounter.receivedSkills;

  const treeData = useMemo(() => {
    const flatRows = Object.values(skills);
    if (flatRows.length === 0) return [];

    const compareNodes = (a: TreeGridNode, b: TreeGridNode) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case 'skill':
          valA = a.label;
          valB = b.label;
          break;
        case 'source':
          valA = a.sourceLabel || '';
          valB = b.sourceLabel || '';
          break;
        case 'sid':
          valA = a.skillId || '';
          valB = b.skillId || '';
          break;
        case 'type':
          valA = a.damageType || '';
          valB = b.damageType || '';
          break;
        case 'hits':
          valA = a.totalHits;
          valB = b.totalHits;
          break;
        case 'maxHit':
          valA = a.maxHit;
          valB = b.maxHit;
          break;
        case 'damage':
        default:
          valA = primaryMetric === 'total' ? a.totalDamage : a.dps;
          valB = primaryMetric === 'total' ? b.totalDamage : b.dps;
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc'
          ? (valA > valB ? 1 : valA < valB ? -1 : 0)
          : (valB > valA ? 1 : valB < valA ? -1 : 0);
      }
    };

    // Group flat entries by skillKey (Level 1)
    const level1Groups: Record<string, SkillDamageRow[]> = {};
    flatRows.forEach(row => {
      const sk = row.skillKey || 'Unknown Skill';
      if (!level1Groups[sk]) level1Groups[sk] = [];
      level1Groups[sk].push(row);
    });

    const rootNodes: TreeGridNode[] = [];

    Object.entries(level1Groups).forEach(([skillKey, l1Rows]) => {
      // If exactly 1 row in this L1 Group, bypass tree construction!
      if (l1Rows.length === 1) {
        const row = l1Rows[0];
        const flatPeakDps = activeTab === 'dealt'
          ? (encounter.peakDpsBySkillKey[skillKey] || row.peakDps || 0)
          : (row.peakDps || 0);

        rootNodes.push({
          key: skillKey,
          label: skillKey,
          sourceLabel: row.source,
          depth: 0,
          hasChildren: false,
          isExpanded: false,
          children: [],
          skillId: row.skillId,
          damageType: row.damageType,
          totalDamage: row.totalDamage,
          dps: row.dps,
          peakDps: flatPeakDps,
          maxHit: row.maxHit,
          totalHits: row.totalHits,
          critHits: row.critHits,
        });
        return;
      }

      // Group level 1 rows by source (Level 2)
      const level2Groups: Record<string, SkillDamageRow[]> = {};
      l1Rows.forEach(row => {
        const src = row.source || 'Player';
        if (!level2Groups[src]) level2Groups[src] = [];
        level2Groups[src].push(row);
      });

      const l1Children: TreeGridNode[] = [];

      let l1TotalDamage = 0;
      let l1TotalHits = 0;
      let l1CritHits = 0;
      let l1MaxHit = 0;
      let l1Dps = 0;
      const l1TypeDamage: Record<string, number> = {};

      Object.entries(level2Groups).forEach(([sourceName, l2Rows]) => {
        const l2Children: TreeGridNode[] = [];
        let l2TotalDamage = 0;
        let l2TotalHits = 0;
        let l2CritHits = 0;
        let l2MaxHit = 0;
        let l2Dps = 0;
        const l2TypeDamage: Record<string, number> = {};

        // Build Level 3 Subskills
        l2Rows.forEach(row => {
          l2TotalDamage += row.totalDamage;
          l2TotalHits += row.totalHits;
          l2CritHits += row.critHits;
          if (row.maxHit > l2MaxHit) l2MaxHit = row.maxHit;
          l2Dps += row.dps;
          l2TypeDamage[row.damageType] = (l2TypeDamage[row.damageType] || 0) + row.totalDamage;

          l2Children.push({
            key: row.key,
            label: row.skillName,
            sourceLabel: row.source,
            depth: 2,
            hasChildren: false,
            isExpanded: false,
            children: [],
            skillId: row.skillId,
            damageType: row.damageType,
            totalDamage: row.totalDamage,
            dps: row.dps,
            peakDps: row.peakDps,
            maxHit: row.maxHit,
            totalHits: row.totalHits,
            critHits: row.critHits,
          });
        });

        // Sum aggregates for Level 2 and Level 1
        l1TotalDamage += l2TotalDamage;
        l1TotalHits += l2TotalHits;
        l1CritHits += l2CritHits;
        if (l2MaxHit > l1MaxHit) l1MaxHit = l2MaxHit;
        l1Dps += l2Dps;
        Object.entries(l2TypeDamage).forEach(([type, val]) => {
          l1TypeDamage[type] = (l1TypeDamage[type] || 0) + val;
        });

        let l2DominantType = 'UNKNOWN';
        let maxL2TypeVal = -1;
        Object.entries(l2TypeDamage).forEach(([type, val]) => {
          if (val > maxL2TypeVal) {
            maxL2TypeVal = val;
            l2DominantType = type;
          }
        });

        const l2Key = `${sourceName}||${skillKey}`;
        const l2PeakDps = activeTab === 'dealt'
          ? (encounter.peakDpsBySourceSkillKey[l2Key] || Math.max(...l2Children.map(c => c.peakDps), 0))
          : Math.max(...l2Children.map(c => c.peakDps), 0);

        l1Children.push({
          key: l2Key,
          label: sourceName,
          sourceLabel: sourceName,
          depth: 1,
          hasChildren: true,
          isExpanded: false,
          children: l2Children.sort(compareNodes),
          skillId: '',
          damageType: l2DominantType,
          totalDamage: l2TotalDamage,
          dps: l2Dps,
          peakDps: l2PeakDps,
          maxHit: l2MaxHit,
          totalHits: l2TotalHits,
          critHits: l2CritHits,
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

      const l1PeakDps = activeTab === 'dealt'
        ? (encounter.peakDpsBySkillKey[skillKey] || Math.max(...l1Children.map(c => c.peakDps), 0))
        : Math.max(...l1Children.map(c => c.peakDps), 0);

      rootNodes.push({
        key: skillKey,
        label: skillKey,
        sourceLabel: '',
        depth: 0,
        hasChildren: true,
        isExpanded: false,
        children: l1Children.sort(compareNodes),
        skillId: '',
        damageType: l1DominantType,
        totalDamage: l1TotalDamage,
        dps: l1Dps,
        peakDps: l1PeakDps,
        maxHit: l1MaxHit,
        totalHits: l1TotalHits,
        critHits: l1CritHits,
      });
    });

    return rootNodes.sort(compareNodes);
  }, [skills, activeTab, encounter.peakDpsBySkillKey, encounter.peakDpsBySourceSkillKey, primaryMetric, sortField, sortOrder]);

  const toggleCollapseExpandAll = useCallback(() => {
    const anyExpanded = Object.values(expandedKeys).some(val => val === true);
    if (anyExpanded) {
      setExpandedKeys({});
    } else {
      const newExpanded: Record<string, boolean> = {};
      const traverse = (nodes: TreeGridNode[]) => {
        nodes.forEach(node => {
          if (node.hasChildren) {
            newExpanded[node.key] = true;
            traverse(node.children);
          }
        });
      };
      traverse(treeData);
      setExpandedKeys(newExpanded);
    }
  }, [expandedKeys, treeData]);

  React.useImperativeHandle(ref, () => ({
    toggleCollapseExpandAll
  }), [toggleCollapseExpandAll]);

  // Flatten the tree data yielding only visible rows based on expandedKeys
  const visibleRows = useMemo(() => {
    const rows: TreeGridNode[] = [];
    const traverse = (nodes: TreeGridNode[]) => {
      nodes.forEach(node => {
        const isExpanded = !!expandedKeys[node.key];
        rows.push({
          ...node,
          isExpanded,
        });
        if (node.hasChildren && isExpanded) {
          traverse(node.children);
        }
      });
    };
    traverse(treeData);
    return rows;
  }, [treeData, expandedKeys]);

  // The bar width is relative to the largest top-level (Level 1) node value
  const maxValue = useMemo(() => {
    if (treeData.length === 0) return 1;
    return primaryMetric === 'total' ? treeData[0].totalDamage : treeData[0].dps;
  }, [treeData, primaryMetric]);

  const handleDrag = useCallback((colName: ColumnId) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Avoid triggering header click sorting!
    const startX = e.clientX;
    const startWidth = colWidths[colName];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(30, startWidth + (moveEvent.clientX - startX));
      setColWidths(prev => ({ ...prev, [colName]: newWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const show = columnVisibility;

  if (visibleRows.length === 0) {
    return <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>No damage recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', width: 'max-content', minWidth: '100%', fontSize: '11px', color: '#aaa', padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', userSelect: 'none', boxSizing: 'border-box' }}>
        {show.skill && <div style={{ width: colWidths.skill, position: 'relative', flexShrink: 0, paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>{renderHeader('skill', 'SKILL')}<Resizer onMouseDown={handleDrag('skill')} /></div>}
        {show.source && <div style={{ width: colWidths.source, position: 'relative', flexShrink: 0, paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>{renderHeader('source', 'SOURCE')}<Resizer onMouseDown={handleDrag('source')} /></div>}
        {show.sid && <div style={{ width: colWidths.sid, position: 'relative', flexShrink: 0, paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>{renderHeader('sid', 'SID')}<Resizer onMouseDown={handleDrag('sid')} /></div>}
        {show.type && <div style={{ width: colWidths.type, position: 'relative', flexShrink: 0, paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>{renderHeader('type', 'TYPE')}<Resizer onMouseDown={handleDrag('type')} /></div>}
        {show.hits && <div style={{ width: colWidths.hits, position: 'relative', flexShrink: 0, paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>{renderHeader('hits', 'HITS')}<Resizer onMouseDown={handleDrag('hits')} /></div>}
        {show.maxHit && <div style={{ width: colWidths.maxHit, position: 'relative', flexShrink: 0, paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>{renderHeader('maxHit', 'MAX HIT')}<Resizer onMouseDown={handleDrag('maxHit')} /></div>}
        {show.damage && (
          <div style={{ width: colWidths.damage, position: 'relative', flexShrink: 0, paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>
            {renderHeader('damage', primaryMetric === 'total' ? 'DAMAGE' : 'DPS')}
          </div>
        )}
      </div>

      {visibleRows.map(row => {
        const rowValue = primaryMetric === 'total' ? row.totalDamage : row.dps;
        const percentOfMax = Math.min(100, (rowValue / maxValue) * 100);
        const color = getColorForType(row.damageType, row.label, row.key);
        const typeColor = getColorForType(row.damageType);

        // Styling hierarchy backgrounds
        let rowBg = 'transparent';
        let borderBottomStyle = '1px solid rgba(255, 255, 255, 0.03)';
        let fontWeight = 'normal';
        let skillColor = '#fff';

        const isBleedRow = color === 'var(--color-bleed)';

        if (row.depth === 0) {
          rowBg = 'rgba(255, 255, 255, 0.05)';
          borderBottomStyle = '1px solid rgba(255, 255, 255, 0.08)';
          fontWeight = '600';
          skillColor = '#ffddaa'; // Accentuate Level 1 Skill Keys
        } else if (row.depth === 1) {
          rowBg = 'rgba(255, 255, 255, 0.015)';
          fontWeight = '500';
          skillColor = '#e0e0e0'; // Accentuate Level 2 Sources
        } else {
          skillColor = isBleedRow ? 'var(--color-physical)' : color; // Leaf nodes show exact subskill elemental color
        }

        return (
          <div
            key={row.key}
            onClick={() => row.hasChildren && toggleExpand(row.key)}
            className="actor-row"
            style={{
              padding: '0',
              position: 'relative',
              width: 'max-content',
              minWidth: '100%',
              boxSizing: 'border-box',
              background: rowBg,
              borderBottom: borderBottomStyle,
              cursor: row.hasChildren ? 'pointer' : 'default',
            }}
          >
            {/* Background Relative Damage Bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${percentOfMax}%`,
                backgroundColor: color,
                opacity: row.depth === 0 ? 0.25 : row.depth === 1 ? 0.15 : 0.08,
                zIndex: 0,
                transition: 'width 0.3s ease',
              }}
            />

            {/* Row Columns Content */}
            <div
              style={{
                display: 'flex',
                width: 'max-content',
                minWidth: '100%',
                position: 'relative',
                zIndex: 1,
                padding: '6px 8px',
                alignItems: 'center',
                fontSize: '12px',
                boxSizing: 'border-box',
              }}
            >
              {/* SKILL Column (with arrow expander and depth indentation) */}
              {show.skill && (
                <div
                  style={{
                    width: colWidths.skill,
                    flexShrink: 0,
                    fontWeight,
                    color: skillColor,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    paddingRight: '10px',
                    boxSizing: 'border-box',
                    paddingLeft: `${10 + row.depth * 14}px`,
                    display: 'flex',
                    alignItems: 'center',
                    borderRight: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  {row.hasChildren ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '6px',
                        cursor: 'pointer',
                        fontSize: '9px',
                        color: '#bbb',
                        width: '12px',
                        transform: row.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                        userSelect: 'none',
                      }}
                    >
                      ▶
                    </span>
                  ) : (
                    <span style={{ display: 'inline-block', width: '18px' }} />
                  )}
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {row.label}
                  </span>
                </div>
              )}

              {/* SOURCE Column */}
              {show.source && (
                <div style={{ width: colWidths.source, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box', color: '#aaa', borderRight: '1px solid rgba(255, 255, 255, 0.12)' }}>
                  {row.sourceLabel || '-'}
                </div>
              )}

              {/* SID Column */}
              {show.sid && (
                <div style={{ width: colWidths.sid, flexShrink: 0, color: '#999', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box', borderRight: '1px solid rgba(255, 255, 255, 0.12)' }}>
                  {row.skillId || '-'}
                </div>
              )}

              {/* TYPE Column */}
              {show.type && (
                <div style={{ width: colWidths.type, flexShrink: 0, color: typeColor, fontWeight: 'bold', fontSize: '10px', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box', borderRight: '1px solid rgba(255, 255, 255, 0.12)' }}>
                  {row.damageType}
                </div>
              )}

              {/* HITS Column */}
              {show.hits && (
                <div style={{ width: colWidths.hits, flexShrink: 0, textAlign: 'right', color: '#ccc', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box', borderRight: '1px solid rgba(255, 255, 255, 0.12)' }}>
                  {row.totalHits}
                </div>
              )}

              {/* MAX HIT Column */}
              {show.maxHit && (
                <div style={{ width: colWidths.maxHit, flexShrink: 0, textAlign: 'right', color: '#ffcc00', fontWeight: '500', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box', borderRight: '1px solid rgba(255, 255, 255, 0.12)' }}>
                  {row.maxHit > 0 ? formatNumber(row.maxHit) : '-'}
                </div>
              )}

              {/* DAMAGE / DPS Column */}
              {show.damage && (
                <div style={{ width: colWidths.damage, flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', paddingLeft: '10px', paddingRight: '10px', boxSizing: 'border-box' }}>
                  {primaryMetric === 'total' ? (
                    <>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(row.totalDamage)}</span>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>{formatNumber(row.dps)} dps</span>
                      {row.peakDps > 0 && (
                        <span style={{ fontSize: '9px', color: '#ff9944' }}>⚡ {formatNumber(row.peakDps)} pk</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(row.dps)} dps</span>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>{formatNumber(row.totalDamage)} tot</span>
                      {row.peakDps > 0 && (
                        <span style={{ fontSize: '9px', color: '#ff9944' }}>⚡ {formatNumber(row.peakDps)} pk</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
  }
);
