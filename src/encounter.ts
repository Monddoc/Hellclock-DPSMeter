import type { EncounterState, SkillDamageRow, DamageEvent, DamageType } from './types';

/** Gap threshold: if no events for this duration, combat is considered paused */
const COMBAT_GAP_MS = 5000;

/** Sliding window size for peak DPS calculation */
const PEAK_DPS_WINDOW_MS = 3000;

export function createEmptySkillRow(key: string, skillId: string, skillKey: string, skillName: string, source: string, damageType: DamageType): SkillDamageRow {
  return {
    key,
    skillId,
    skillKey,
    skillName,
    source,
    damageType,
    totalDamage: 0,
    dps: 0,
    peakDps: 0,
    maxHit: 0,
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
    activeDurationMs: 0,
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    peakDpsDealt: 0,
    peakDpsReceived: 0,
    dealtSkills: {},
    receivedSkills: {},
    peakDpsBySkillKey: {},
    peakDpsBySourceSkillKey: {},
    lastHitReceived: null,
    bleedUptimeMs: 0,
    igniteUptimeMs: 0,
    _lastBleedTickTime: 0,
    _lastIgniteTickTime: 0,
    _lastEventTime: 0,
    _recentEvents: []
  };
}

function updateSkillRow(row: SkillDamageRow, ev: DamageEvent): void {
  row.totalDamage += ev.value;
  row.totalHits += 1;
  if (ev.isCrit) row.critHits += 1;
  if (ev.value > row.maxHit) row.maxHit = ev.value;

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

  next.peakDpsBySkillKey = { ...prev.peakDpsBySkillKey };
  next.peakDpsBySourceSkillKey = { ...prev.peakDpsBySourceSkillKey };

  // Shallow-copy the recent events buffer so we don't mutate the previous state
  next._recentEvents = [...prev._recentEvents];

  let isFirstEvent = next.startTime === 0;

  events.forEach(ev => {
    if (isFirstEvent) {
      next.startTime = ev.timeMs;
      next._lastEventTime = ev.timeMs;
      isFirstEvent = false;
    }

    // ── Active combat time (gap detection) ──────────────────────────
    if (next._lastEventTime > 0) {
      const gap = ev.timeMs - next._lastEventTime;
      if (gap > 0 && gap <= COMBAT_GAP_MS) {
        next.activeDurationMs += gap;
      }
      // Gaps > COMBAT_GAP_MS are excluded (combat was paused)
    }
    next._lastEventTime = ev.timeMs;

    next.lastDamageTime = Math.max(next.lastDamageTime, ev.timeMs);

    // Defensive: match exactly 'Player' or strings that START with 'Summon'
    // to avoid misclassifying enemies with 'Summon' in their name mid-word
    const isPlayerSource = ev.source === 'Player' || ev.source.startsWith('Summon');
    const isPlayerTarget = ev.target === 'Player';

    // Construct flat row key with safe delimiter: rowKey = `${ev.source}||${ev.skillKey}||${ev.skillName}||${ev.damageType}`
    const rowKey = `${ev.source}||${ev.skillKey}||${ev.skillName}||${ev.damageType}`;

    if (isPlayerSource) {
      next.totalDamageDealt += ev.value;
      if (!next.dealtSkills[rowKey]) {
        next.dealtSkills[rowKey] = createEmptySkillRow(rowKey, ev.skillId, ev.skillKey, ev.skillName, ev.source, ev.damageType);
      }
      updateSkillRow(next.dealtSkills[rowKey], ev);
      next._recentEvents.push({ timeMs: ev.timeMs, value: ev.value, isDealt: true, rowKey });

      // Ailment Uptime Tracking
      if (ev.ailment === 'BLEED') {
        if (next._lastBleedTickTime > 0) {
          const gap = ev.timeMs - next._lastBleedTickTime;
          if (gap > 0 && gap <= 3000) {
            next.bleedUptimeMs += gap;
          }
        }
        next._lastBleedTickTime = ev.timeMs;
      } else if (ev.ailment === 'IGNITE') {
        if (next._lastIgniteTickTime > 0) {
          const gap = ev.timeMs - next._lastIgniteTickTime;
          if (gap > 0 && gap <= 3000) {
            next.igniteUptimeMs += gap;
          }
        }
        next._lastIgniteTickTime = ev.timeMs;
      }
    }

    if (isPlayerTarget) {
      next.totalDamageReceived += ev.value;
      if (!next.receivedSkills[rowKey]) {
        next.receivedSkills[rowKey] = createEmptySkillRow(rowKey, ev.skillId, ev.skillKey, ev.skillName, ev.source, ev.damageType);
      }
      updateSkillRow(next.receivedSkills[rowKey], ev);
      next.lastHitReceived = ev;
      next._recentEvents.push({ timeMs: ev.timeMs, value: ev.value, isDealt: false, rowKey });
    }
  });

  // ── Wall-clock duration ─────────────────────────────────────────
  next.durationMs = next.lastDamageTime - next.startTime;
  if (next.durationMs <= 0) next.durationMs = 1000;

  // Ensure activeDurationMs has a sensible minimum for DPS calculation
  const activeSec = Math.max(next.activeDurationMs, 1000) / 1000;

  // ── Per-skill DPS (uses active combat time) ─────────────────────
  Object.values(next.dealtSkills).forEach(row => { row.dps = row.totalDamage / activeSec; });
  Object.values(next.receivedSkills).forEach(row => { row.dps = row.totalDamage / activeSec; });

  // ── Peak DPS (3-second sliding window) ──────────────────────────
  const windowCutoff = next.lastDamageTime - PEAK_DPS_WINDOW_MS;
  next._recentEvents = next._recentEvents.filter(e => e.timeMs >= windowCutoff);

  // Effective window duration: capped at PEAK_DPS_WINDOW_MS or encounter age
  const encounterAgeMs = next.lastDamageTime - next.startTime;
  const windowMs = Math.min(PEAK_DPS_WINDOW_MS, encounterAgeMs);
  const windowSec = Math.max(windowMs / 1000, 0.1);

  let rollingDealt = 0;
  let rollingReceived = 0;
  const skillRolling: Record<string, number> = {};
  const skillKeyRolling: Record<string, number> = {};
  const sourceSkillKeyRolling: Record<string, number> = {};

  for (const e of next._recentEvents) {
    if (e.isDealt) rollingDealt += e.value;
    else rollingReceived += e.value;
    skillRolling[e.rowKey] = (skillRolling[e.rowKey] || 0) + e.value;

    const parts = e.rowKey.split('||');
    if (parts.length >= 4) {
      const source = parts[0];
      const skillKey = parts[1];
      
      const skillKeyGroup = skillKey;
      const sourceSkillKeyGroup = `${source}||${skillKey}`;
      
      skillKeyRolling[skillKeyGroup] = (skillKeyRolling[skillKeyGroup] || 0) + e.value;
      sourceSkillKeyRolling[sourceSkillKeyGroup] = (sourceSkillKeyRolling[sourceSkillKeyGroup] || 0) + e.value;
    }
  }

  const rollingDpsDealt = rollingDealt / windowSec;
  const rollingDpsReceived = rollingReceived / windowSec;

  if (rollingDpsDealt > next.peakDpsDealt) next.peakDpsDealt = rollingDpsDealt;
  if (rollingDpsReceived > next.peakDpsReceived) next.peakDpsReceived = rollingDpsReceived;

  for (const [key, totalInWindow] of Object.entries(skillRolling)) {
    const dps = totalInWindow / windowSec;
    const skill = next.dealtSkills[key] || next.receivedSkills[key];
    if (skill && dps > skill.peakDps) skill.peakDps = dps;
  }

  // Update group peaks statefully
  for (const [groupKey, totalInWindow] of Object.entries(skillKeyRolling)) {
    const dps = totalInWindow / windowSec;
    if (!(groupKey in next.peakDpsBySkillKey) || dps > next.peakDpsBySkillKey[groupKey]) {
      next.peakDpsBySkillKey[groupKey] = dps;
    }
  }

  for (const [groupKey, totalInWindow] of Object.entries(sourceSkillKeyRolling)) {
    const dps = totalInWindow / windowSec;
    if (!(groupKey in next.peakDpsBySourceSkillKey) || dps > next.peakDpsBySourceSkillKey[groupKey]) {
      next.peakDpsBySourceSkillKey[groupKey] = dps;
    }
  }

  return next;
}
