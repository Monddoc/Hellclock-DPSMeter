import React, { useState, useEffect, useCallback } from 'react';
import type { SkillDamageRow } from '../types';
import { formatNumber } from '../utils';

const COL_WIDTHS_KEY = 'hellclock_col_widths';

const DEFAULT_WIDTHS = { source: 100, skill: 150, type: 80, hits: 50, damage: 100 };

function loadColWidths() {
  try {
    const saved = localStorage.getItem(COL_WIDTHS_KEY);
    if (saved) return { ...DEFAULT_WIDTHS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_WIDTHS };
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
  isDealtTab?: boolean;
  primaryMetric: 'total' | 'dps';
}

export const DamageMeter: React.FC<Props> = ({ skills, isDealtTab, primaryMetric }) => {
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

  const handleDrag = useCallback((colName: keyof typeof colWidths) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colName];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(30, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev: typeof DEFAULT_WIDTHS) => ({ ...prev, [colName]: newWidth }));
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

  if (sortedSkills.length === 0) {
    return <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>No damage recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', fontSize: '11px', color: '#aaa', padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', userSelect: 'none' }}>
        {isDealtTab && <div style={{ width: colWidths.source, position: 'relative', flexShrink: 0 }}>SOURCE<Resizer onMouseDown={handleDrag('source')} /></div>}
        <div style={{ width: colWidths.skill, position: 'relative', flexShrink: 0 }}>SKILL<Resizer onMouseDown={handleDrag('skill')} /></div>
        <div style={{ width: colWidths.type, position: 'relative', flexShrink: 0 }}>TYPE<Resizer onMouseDown={handleDrag('type')} /></div>
        <div style={{ width: colWidths.hits, position: 'relative', flexShrink: 0, textAlign: 'right' }}>HITS<Resizer onMouseDown={handleDrag('hits')} /></div>
        <div style={{ flex: 1, minWidth: colWidths.damage, textAlign: 'right' }}>
          {primaryMetric === 'total' ? 'DAMAGE' : 'DPS'}
        </div>
      </div>

      {sortedSkills.map(row => {
        const rowValue = primaryMetric === 'total' ? row.totalDamage : row.dps;
        const percentOfMax = (rowValue / maxValue) * 100;
        const color = getColorForType(row.damageType);
        const displayName = isDealtTab
          ? row.skillId
          : (row.source === 'Player' ? row.skillId : `${row.source} | ${row.skillId}`);

        return (
          <div key={row.key} className="actor-row" style={{ padding: '0', position: 'relative' }}>
            {/* Background bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${percentOfMax}%`,
              backgroundColor: color, opacity: 0.2, zIndex: 0
            }} />

            {/* Content */}
            <div style={{ display: 'flex', position: 'relative', zIndex: 1, padding: '6px 8px', alignItems: 'center', fontSize: '12px' }}>
              {isDealtTab && (
                <div style={{ width: colWidths.source, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: '4px', color: '#aaa' }}>
                  {row.source}
                </div>
              )}
              <div style={{ width: colWidths.skill, flexShrink: 0, fontWeight: '500', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: '4px' }}>
                {displayName}
              </div>
              <div style={{ width: colWidths.type, flexShrink: 0, color, fontWeight: 'bold', fontSize: '10px' }}>
                {row.damageType}
              </div>
              <div style={{ width: colWidths.hits, flexShrink: 0, textAlign: 'right', color: '#ccc', paddingRight: '4px' }}>
                {row.totalHits}
              </div>
              <div style={{ flex: 1, minWidth: colWidths.damage, textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                {primaryMetric === 'total' ? (
                  <>
                    <span style={{ fontWeight: 'bold' }}>{formatNumber(row.totalDamage)}</span>
                    <span style={{ fontSize: '10px', color: '#aaa' }}>{formatNumber(row.dps)} dps</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 'bold' }}>{formatNumber(row.dps)} dps</span>
                    <span style={{ fontSize: '10px', color: '#aaa' }}>{formatNumber(row.totalDamage)} total</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
