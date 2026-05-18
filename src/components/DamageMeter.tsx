import React, { useState } from 'react';
import type { SkillDamageRow } from '../types';

interface Props {
  skills: Record<string, SkillDamageRow>;
}

export const DamageMeter: React.FC<Props> = ({ skills }) => {
  const [colWidths, setColWidths] = useState({ skill: 150, type: 80, hits: 50, damage: 100 });

  const sortedSkills = Object.values(skills).sort((a, b) => b.totalDamage - a.totalDamage);
  const maxDamage = sortedSkills.length > 0 ? sortedSkills[0].totalDamage : 1;

  const handleDrag = (colName: keyof typeof colWidths) => (e: React.MouseEvent) => {
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
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'PHYSICAL': return 'var(--color-physical)';
      case 'FIRE': return 'var(--color-fire)';
      case 'LIGHTNING': return 'var(--color-lightning)';
      case 'PLAGUE': return 'var(--color-plague)';
      default: return 'var(--color-unknown)';
    }
  };

  if (sortedSkills.length === 0) {
    return <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>No damage recorded yet.</div>;
  }

  const Resizer = ({ colName }: { colName: keyof typeof colWidths }) => (
    <div 
      onMouseDown={handleDrag(colName)} 
      style={{ 
        position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, 
        cursor: 'col-resize', zIndex: 10, background: 'rgba(255,255,255,0.0)' 
      }} 
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.0)')}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
      <div style={{ display: 'flex', fontSize: '11px', color: '#aaa', padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', userSelect: 'none' }}>
        <div style={{ width: colWidths.skill, position: 'relative', flexShrink: 0 }}>SKILL<Resizer colName="skill" /></div>
        <div style={{ width: colWidths.type, position: 'relative', flexShrink: 0 }}>TYPE<Resizer colName="type" /></div>
        <div style={{ width: colWidths.hits, position: 'relative', flexShrink: 0, textAlign: 'right' }}>HITS<Resizer colName="hits" /></div>
        <div style={{ flex: 1, minWidth: colWidths.damage, textAlign: 'right' }}>DAMAGE</div>
      </div>
      
      {sortedSkills.map(row => {
        const percentOfMax = (row.totalDamage / maxDamage) * 100;
        const color = getColorForType(row.damageType);
        const displayName = `${row.source} (SID: ${row.skillId})`;

        return (
          <div key={row.key} className="actor-row" style={{ padding: '0', position: 'relative' }}>
            {/* Background Bar */}
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${percentOfMax}%`,
                backgroundColor: color,
                opacity: 0.2,
                zIndex: 0
              }}
            />
            
            {/* Content Columns */}
            <div style={{ display: 'flex', position: 'relative', zIndex: 1, padding: '6px 8px', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ width: colWidths.skill, flexShrink: 0, fontWeight: '500', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: '4px' }}>
                {displayName}
              </div>
              <div style={{ width: colWidths.type, flexShrink: 0, color: color, fontWeight: 'bold', fontSize: '10px' }}>
                {row.damageType}
              </div>
              <div style={{ width: colWidths.hits, flexShrink: 0, textAlign: 'right', color: '#ccc', paddingRight: '4px' }}>
                {row.totalHits}
              </div>
              <div style={{ flex: 1, minWidth: colWidths.damage, textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>{row.totalDamage.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span style={{ fontSize: '10px', color: '#aaa' }}>{row.dps.toLocaleString(undefined, { maximumFractionDigits: 0 })} dps</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
