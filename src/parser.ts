import type { DamageEvent, DamageType, AilmentType } from './types';

export function parseLogLine(line: string): DamageEvent[] {
  // e.g. (04:38:17:116)S:Player|T:|SID:1|V:7,734.42|FIRE:7,734.42
  // e.g. (04:41:06:530)S:Summon  The  Guard -|T:Cursed Rat|SID:202|V:2,947.90|DOT|PHYSICAL:2,947.90
  
  const match = line.match(/^\((.*?)\)S:(.*?)\|T:(.*?)\|(?:SID|SK):(.*?)\|V:([\d,.]+)\|(.*)$/);
  if (!match) return [];

  const [, timeStr, sourceStr, targetStr, skillIdStr, valueStr, restStr] = match;
  
  const timeMs = parseTimeToMs(timeStr);
  const totalValue = parseFloat(valueStr.replace(/,/g, ''));
  
  let isCrit = false;
  let isDot = false;
  
  const tags = restStr.split('|');
  const typeValues: { type: DamageType, value: number }[] = [];
  
  for (const tag of tags) {
    if (tag === 'CRIT') isCrit = true;
    else if (tag === 'DOT') isDot = true;
    else if (tag.startsWith('PHYSICAL:')) typeValues.push({ type: 'PHYSICAL', value: parseFloat(tag.split(':')[1].replace(/,/g, '')) });
    else if (tag.startsWith('FIRE:')) typeValues.push({ type: 'FIRE', value: parseFloat(tag.split(':')[1].replace(/,/g, '')) });
    else if (tag.startsWith('LIGHTNING:')) typeValues.push({ type: 'LIGHTNING', value: parseFloat(tag.split(':')[1].replace(/,/g, '')) });
    else if (tag.startsWith('PLAGUE:')) typeValues.push({ type: 'PLAGUE', value: parseFloat(tag.split(':')[1].replace(/,/g, '')) });
  }

  const events: DamageEvent[] = [];
  
  const createEvent = (damageType: DamageType, val: number, critFlag: boolean): DamageEvent => {
    let ailment: AilmentType = 'NONE';
    if (isDot && damageType === 'PHYSICAL') ailment = 'BLEED';
    if (isDot && damageType === 'FIRE') ailment = 'IGNITE';

    return {
      timestamp: timeStr,
      timeMs,
      source: sourceStr.trim(),
      target: targetStr.trim() || 'Unknown Target',
      skillId: cleanSkillName(skillIdStr),
      value: val,
      damageType,
      ailment,
      isCrit: critFlag,
      isDot,
      rawLine: line
    };
  };

  if (typeValues.length > 0) {
    for (let i = 0; i < typeValues.length; i++) {
      // Only the first event from a split hit carries the crit flag to avoid double-counting
      events.push(createEvent(typeValues[i].type, typeValues[i].value, i === 0 ? isCrit : false));
    }
  } else {
    events.push(createEvent('UNKNOWN', totalValue, isCrit));
  }

  return events;
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

function cleanSkillName(name: string): string {
  if (!name) return name;
  return name
    .replace(/Skill\s*Definition/gi, '')
    .replace(/SkillDefinition/gi, '')
    .replace(/Skill/gi, '')
    .replace(/Definition/gi, '')
    .replace(/\bQuils\b/gi, 'Quills')
    .replace(/\s+/g, ' ')
    .trim();
}
