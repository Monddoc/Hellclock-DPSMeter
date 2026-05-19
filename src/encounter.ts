import type { EncounterState, SkillDamageRow, DamageEvent, DamageType } from './types';

export function createEmptySkillRow(key: string, skillId: string, source: string, damageType: DamageType): SkillDamageRow {
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

export function createEmptyEncounter(): EncounterState {
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

function updateSkillRow(row: SkillDamageRow, ev: DamageEvent): void {
  row.totalDamage += ev.value;
  row.totalHits += 1;
  if (ev.isCrit) row.critHits += 1;

  if (ev.ailment !== 'NONE') {
    row.ailmentDamage[ev.ailment] = (row.ailmentDamage[ev.ailment] || 0) + ev.value;
  }
}

export function applyEvents(prev: EncounterState, events: DamageEvent[]): EncounterState {
  const next = { ...prev };
  next.dealtSkills = { ...prev.dealtSkills };
  for (const k in next.dealtSkills) {
    next.dealtSkills[k] = { ...next.dealtSkills[k], ailmentDamage: { ...next.dealtSkills[k].ailmentDamage } };
  }

  next.receivedSkills = { ...prev.receivedSkills };
  for (const k in next.receivedSkills) {
    next.receivedSkills[k] = { ...next.receivedSkills[k], ailmentDamage: { ...next.receivedSkills[k].ailmentDamage } };
  }

  let isFirstEvent = next.startTime === 0;

  events.forEach(ev => {
    if (isFirstEvent) {
      next.startTime = ev.timeMs;
      isFirstEvent = false;
    }
    next.lastDamageTime = Math.max(next.lastDamageTime, ev.timeMs);

    // Defensive: match exactly 'Player' or strings that START with 'Summon'
    // to avoid misclassifying enemies with 'Summon' in their name mid-word
    const isPlayerSource = ev.source === 'Player' || ev.source.startsWith('Summon');
    const isPlayerTarget = ev.target === 'Player';

    const rowKey = `${ev.source}_${ev.skillId}_${ev.damageType}`;

    if (isPlayerSource) {
      next.totalDamageDealt += ev.value;
      if (!next.dealtSkills[rowKey]) {
        next.dealtSkills[rowKey] = createEmptySkillRow(rowKey, ev.skillId, ev.source, ev.damageType);
      }
      updateSkillRow(next.dealtSkills[rowKey], ev);
    }

    if (isPlayerTarget) {
      next.totalDamageReceived += ev.value;
      if (!next.receivedSkills[rowKey]) {
        next.receivedSkills[rowKey] = createEmptySkillRow(rowKey, ev.skillId, ev.source, ev.damageType);
      }
      updateSkillRow(next.receivedSkills[rowKey], ev);
      next.lastHitReceived = ev;
    }
  });

  next.durationMs = next.lastDamageTime - next.startTime;
  if (next.durationMs <= 0) next.durationMs = 1000;

  const durationSec = next.durationMs / 1000;
  Object.values(next.dealtSkills).forEach(row => { row.dps = row.totalDamage / durationSec; });
  Object.values(next.receivedSkills).forEach(row => { row.dps = row.totalDamage / durationSec; });

  return next;
}
