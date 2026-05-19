export type DamageType = 'PHYSICAL' | 'FIRE' | 'LIGHTNING' | 'PLAGUE' | 'UNKNOWN';
export type AilmentType = 'BLEED' | 'IGNITE' | 'NONE';

export interface DamageEvent {
  timestamp: string; // format: 04:38:17:116
  timeMs: number;
  source: string;
  target: string;
  skillId: string;   // SID value (numeric ID)
  skillName: string; // SN value (display name)
  value: number;
  damageType: DamageType;
  ailment: AilmentType;
  isCrit: boolean;
  isDot: boolean;
  rawLine: string;
}

export interface SkillDamageRow {
  key: string;
  skillId: string;   // SID value (numeric ID)
  skillName: string; // SN value (display name)
  source: string;
  damageType: DamageType;
  totalDamage: number;
  dps: number;
  peakDps: number;
  totalHits: number;
  critHits: number;
  ailmentDamage: Record<AilmentType, number>;
}

/** Internal tracker for the peak-DPS sliding window */
export interface RecentEvent {
  timeMs: number;
  value: number;
  isDealt: boolean;
  rowKey: string;
}

export interface EncounterState {
  startTime: number;
  lastDamageTime: number;
  durationMs: number;
  activeDurationMs: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  peakDpsDealt: number;
  peakDpsReceived: number;
  dealtSkills: Record<string, SkillDamageRow>;
  receivedSkills: Record<string, SkillDamageRow>;
  lastHitReceived: DamageEvent | null;
  /** Last event timestamp — used for gap detection */
  _lastEventTime: number;
  /** Recent events buffer — used for peak DPS sliding window */
  _recentEvents: RecentEvent[];
}

export interface Keybindings {
  toggleLock: string;
  toggleMinimalist: string;
  resetEncounter: string;
  openReport: string;
}

declare global {
  interface Window {
    electronAPI: {
      windowControl: (action: 'close' | 'minimize') => void;
      setOpacity: (opacity: number) => void;
      selectFolder: () => Promise<string | null>;
      startWatching: (folderPath: string) => Promise<boolean>;
      exportHtml: (htmlContent: string) => Promise<boolean>;
      onNewLogLines: (callback: (lines: string[]) => void) => () => void;
      onLogCleared: (callback: () => void) => () => void;
      onLockStateChanged: (callback: (locked: boolean) => void) => () => void;
      requestToggleLock: () => void;
      onToggleMinimalist: (callback: () => void) => () => void;
      requestToggleMinimalist: () => void;
      onBackendLog: (callback: (msg: string) => void) => () => void;
      getKeybindings: () => Promise<Keybindings>;
      saveKeybindings: (bindings: Keybindings) => Promise<boolean>;
      onResetEncounter: (callback: () => void) => () => void;
      onOpenReport: (callback: () => void) => () => void;
    };
  }
}
