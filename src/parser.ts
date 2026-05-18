import type { DamageEvent, DamageType, AilmentType } from './types';

export function parseLogLine(line: string): DamageEvent | null {
  // e.g. (04:38:17:116)S:Player|T:|SID:1|V:7,734.42|FIRE:7,734.42
  // e.g. (04:41:06:530)S:Summon  The  Guard -|T:Cursed Rat|SID:202|V:2,947.90|DOT|PHYSICAL:2,947.90
  
  const match = line.match(/^\((.*?)\)S:(.*?)\|T:(.*?)\|SID:(.*?)\|V:([\d,.]+)\|(.*)$/);
  if (!match) return null;

  const [, timeStr, sourceStr, targetStr, skillIdStr, valueStr, restStr] = match;
  
  const timeMs = parseTimeToMs(timeStr);
  const value = parseFloat(valueStr.replace(/,/g, ''));
  
  let isCrit = false;
  let isDot = false;
  let damageType: DamageType = 'UNKNOWN';
  let ailment: AilmentType = 'NONE';
  
  const tags = restStr.split('|');
  
  for (const tag of tags) {
    if (tag === 'CRIT') isCrit = true;
    else if (tag === 'DOT') isDot = true;
    else if (tag.startsWith('PHYSICAL:')) {
      damageType = 'PHYSICAL';
    } else if (tag.startsWith('FIRE:')) {
      damageType = 'FIRE';
    } else if (tag.startsWith('LIGHTNING:')) {
      damageType = 'LIGHTNING';
    } else if (tag.startsWith('PLAGUE:')) {
      damageType = 'PLAGUE';
    }
  }

  // Determine ailments based on DoT + Base Type (as requested by user)
  if (isDot && damageType === 'PHYSICAL') ailment = 'BLEED';
  if (isDot && damageType === 'FIRE') ailment = 'IGNITE';

  return {
    timestamp: timeStr,
    timeMs,
    source: sourceStr.trim(),
    target: targetStr.trim() || 'Unknown Target',
    skillId: skillIdStr,
    value,
    damageType,
    ailment,
    isCrit,
    isDot,
    rawLine: line
  };
}

function parseTimeToMs(timeStr: string): number {
  // timeStr: 04:38:17:116
  const parts = timeStr.split(':');
  if (parts.length !== 4) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  const ms = parseInt(parts[3], 10);
  return (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + ms;
}
