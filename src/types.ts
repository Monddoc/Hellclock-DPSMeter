export type DamageType = 'PHYSICAL' | 'FIRE' | 'LIGHTNING' | 'PLAGUE' | 'UNKNOWN';
export type AilmentType = 'BLEED' | 'IGNITE' | 'NONE';

export interface DamageEvent {
  timestamp: string; // format: 04:38:17:116
  timeMs: number;
  source: string;
  target: string;
  skillId: string;
  value: number;
  damageType: DamageType;
  ailment: AilmentType;
  isCrit: boolean;
  isDot: boolean;
  rawLine: string;
}

export interface SkillDamageRow {
  key: string;
  skillId: string;
  source: string;
  damageType: DamageType;
  totalDamage: number;
  dps: number;
  totalHits: number;
  critHits: number;
  ailmentDamage: Record<AilmentType, number>;
}

export interface EncounterState {
  startTime: number;
  lastDamageTime: number;
  durationMs: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  dealtSkills: Record<string, SkillDamageRow>;
  receivedSkills: Record<string, SkillDamageRow>;
  lastHitReceived: DamageEvent | null;
}

declare global {
  interface Window {
    electronAPI: {
      windowControl: (action: 'close' | 'minimize') => void;
      setOpacity: (opacity: number) => void;
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
      selectFolder: () => Promise<string | null>;
      startWatching: (folderPath: string) => Promise<boolean>;
      exportHtml: (htmlContent: string) => Promise<boolean>;
      onNewLogLines: (callback: (lines: string[]) => void) => void;
      onLogCleared: (callback: () => void) => void;
    };
  }
}
