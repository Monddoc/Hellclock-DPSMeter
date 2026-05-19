import React, { useState, useEffect, useCallback } from 'react';
import type { SkillDamageRow } from '../types';
import { formatNumber } from '../utils';

const COL_WIDTHS_KEY = 'hellclock_col_widths';
const COL_VISIBILITY_KEY = 'hellclock_col_visibility';

export type ColumnId = 'source' | 'skill' | 'sid' | 'type' | 'hits' | 'damage';

export const COLUMN_LABELS: Record<ColumnId, string> = {
  source: 'Source',
  skill: 'Skill',
  sid: 'SID',
  type: 'Type',
  hits: 'Hits',
  damage: 'Damage / DPS',
};

/** All columns in display order */
export const ALL_COLUMNS: ColumnId[] = ['source', 'skill', 'sid', 'type', 'hits', 'damage'];

const DEFAULT_WIDTHS: Record<ColumnId, number> = { source: 100, skill: 130, sid: 60, type: 80, hits: 60, damage: 100 };

const DEFAULT_VISIBILITY: Record<ColumnId, boolean> = {
  source: true, skill: true, sid: true, type: true, hits: true, damage: true,
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

/** Defined outside DamageMeter so React doesn't recreate it on every render */
const Resizer: React.FC<ResizerProps> = ({ onMouseDown }) => (
  <div
    onMouseDown={onMouseDown}
    style={{
      position: 'absolute', right: -3, top: 0, bottom: 0, width: 6,
      cursor: 'col-resize', zIndex: 10, background: 'rgba(255,255,255,0.0)'
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.0)')}
  />
);

interface Props {
  skills: Record<string, SkillDamageRow>;
  primaryMetric: 'total' | 'dps';
  columnVisibility: Record<ColumnId, boolean>;
}

export const DamageMeter: React.FC<Props> = ({ skills, primaryMetric, columnVisibility }) => {
  const [colWidths, setColWidths] = useState(loadColWidths);

  // Persist column widths whenever they change
  useEffect(() => {
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

  const sortedSkills = Object.values(skills).sort((a, b) =>
    primaryMetric === 'total' ? b.totalDamage - a.totalDamage : b.dps - a.dps
  );
  const maxValue = sortedSkills.length > 0
    ? (primaryMetric === 'total' ? sortedSkills[0].totalDamage : sortedSkills[0].dps)
    : 1;

  const handleDrag = useCallback((colName: ColumnId) => (e: React.MouseEvent) => {
    e.preventDefault();
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

  const getColorForType = (type: string) => {
    switch (type) {
      case 'PHYSICAL': return 'var(--color-physical)';
      case 'FIRE':     return 'var(--color-fire)';
      case 'LIGHTNING':return 'var(--color-lightning)';
      case 'PLAGUE':   return 'var(--color-plague)';
      default:         return 'var(--color-unknown)';
    }
  };

  const show = columnVisibility;

  if (sortedSkills.length === 0) {
    return <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>No damage recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', width: 'max-content', minWidth: '100%', fontSize: '11px', color: '#aaa', padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', userSelect: 'none', boxSizing: 'border-box' }}>
        {show.source && <div style={{ width: colWidths.source, position: 'relative', flexShrink: 0, paddingRight: '8px', boxSizing: 'border-box' }}>SOURCE<Resizer onMouseDown={handleDrag('source')} /></div>}
        {show.skill && <div style={{ width: colWidths.skill, position: 'relative', flexShrink: 0, paddingRight: '8px', boxSizing: 'border-box' }}>SKILL<Resizer onMouseDown={handleDrag('skill')} /></div>}
        {show.sid && <div style={{ width: colWidths.sid, position: 'relative', flexShrink: 0, paddingRight: '8px', boxSizing: 'border-box' }}>SID<Resizer onMouseDown={handleDrag('sid')} /></div>}
        {show.type && <div style={{ width: colWidths.type, position: 'relative', flexShrink: 0, paddingRight: '8px', boxSizing: 'border-box' }}>TYPE<Resizer onMouseDown={handleDrag('type')} /></div>}
        {show.hits && <div style={{ width: colWidths.hits, position: 'relative', flexShrink: 0, textAlign: 'right', paddingRight: '8px', boxSizing: 'border-box' }}>HITS<Resizer onMouseDown={handleDrag('hits')} /></div>}
        {show.damage && (
          <div style={{ width: colWidths.damage, position: 'relative', flexShrink: 0, textAlign: 'right', paddingRight: '8px', boxSizing: 'border-box' }}>
            {primaryMetric === 'total' ? 'DAMAGE' : 'DPS'}
            <Resizer onMouseDown={handleDrag('damage')} />
          </div>
        )}
      </div>

      {sortedSkills.map(row => {
        const rowValue = primaryMetric === 'total' ? row.totalDamage : row.dps;
        const percentOfMax = (rowValue / maxValue) * 100;
        const color = getColorForType(row.damageType);

        return (
          <div key={row.key} className="actor-row" style={{ padding: '0', position: 'relative', width: 'max-content', minWidth: '100%', boxSizing: 'border-box' }}>
            {/* Background bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${percentOfMax}%`,
              backgroundColor: color, opacity: 0.2, zIndex: 0
            }} />

            {/* Content */}
            <div style={{ display: 'flex', width: 'max-content', minWidth: '100%', position: 'relative', zIndex: 1, padding: '6px 8px', alignItems: 'center', fontSize: '12px', boxSizing: 'border-box' }}>
              {show.source && (
                <div style={{ width: colWidths.source, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: '8px', boxSizing: 'border-box', color: '#aaa' }}>
                  {row.source}
                </div>
              )}
              {show.skill && (
                <div style={{ width: colWidths.skill, flexShrink: 0, fontWeight: '500', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: '8px', boxSizing: 'border-box' }}>
                  {row.skillName}
                </div>
              )}
              {show.sid && (
                <div style={{ width: colWidths.sid, flexShrink: 0, color: '#ccc', paddingRight: '8px', boxSizing: 'border-box' }}>
                  {row.skillId}
                </div>
              )}
              {show.type && (
                <div style={{ width: colWidths.type, flexShrink: 0, color, fontWeight: 'bold', fontSize: '10px', paddingRight: '8px', boxSizing: 'border-box' }}>
                  {row.damageType}
                </div>
              )}
              {show.hits && (
                <div style={{ width: colWidths.hits, flexShrink: 0, textAlign: 'right', color: '#ccc', paddingRight: '8px', boxSizing: 'border-box' }}>
                  {row.totalHits}
                </div>
              )}
              {show.damage && (
                <div style={{ width: colWidths.damage, flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', paddingRight: '8px', boxSizing: 'border-box' }}>
                  {primaryMetric === 'total' ? (
                    <>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(row.totalDamage)}</span>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>{formatNumber(row.dps)} dps</span>
                      {row.peakDps > 0 && (
                        <span style={{ fontSize: '9px', color: '#ff9944' }}>⚡ {formatNumber(row.peakDps)} peak</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 'bold' }}>{formatNumber(row.dps)} dps</span>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>{formatNumber(row.totalDamage)} total</span>
                      {row.peakDps > 0 && (
                        <span style={{ fontSize: '9px', color: '#ff9944' }}>⚡ {formatNumber(row.peakDps)} peak</span>
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
};
