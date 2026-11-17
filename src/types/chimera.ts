export type AppView = 'compose' | 'stage' | 'studio' | 'verify' | 'kiroween';
export type ExperienceTierId = 'discovery' | 'explorer' | 'algebra';
export type CodexCompatibilityStatus = 'resonant' | 'organic' | 'tension';

export type SynthVoiceId = 'music-box' | 'celestial-chime' | 'haunted-organ' | 'analog-pluck';
export type ArtModeId = 'harmonograph' | 'mandala' | 'ribbon' | 'pitch-spiral';
export type MathFoundationId = 'harmonic-sine' | 'fibonacci' | 'golden-ratio' | 'pythagorean';

export const SHEET_COLS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type SheetCol = (typeof SHEET_COLS)[number];

export const SHEET_ROWS = 8;
export const MAX_SHEET_ROWS = 48;

export const COLUMN_META: Record<
  SheetCol,
  { label: string; unit: string; hint: string }
> = {
  A: { label: 'Pitch', unit: 'Hz', hint: 'Carrier frequency (20–4000 Hz)' },
  B: { label: 'Gate', unit: '0..1', hint: 'Trigger / velocity (0 = rest)' },
  C: { label: 'FM Mod', unit: 'idx', hint: 'Harmonic modulation depth (0–12)' },
  D: { label: 'Orbit X', unit: 'px', hint: 'Vector plotter X phase (10–100)' },
  E: { label: 'Decay', unit: 'ms', hint: 'Envelope release (40–900 ms)' },
  F: { label: 'Harmonic', unit: 'ratio', hint: 'Modulator ratio (0.25–8)' },
};

export type SheetRawGrid = Record<string, string>;

export interface EvaluatedCell {
  coord: string;
  raw: string;
  value: number;
  error?: string;
  isFormula: boolean;
}

export interface EvaluatedRowStep {
  row: number;
  freqHz: number;
  gate: number;
  fmIndex: number;
  orbitX: number;
  decayMs: number;
  modRatio: number;
  noteName: string;
  hasError: boolean;
}

export interface SheetEvaluationResult {
  cells: Record<string, EvaluatedCell>;
  steps: EvaluatedRowStep[];
  stepCount: number;
  errorCount: number;
  cycleCoords: string[];
}

export interface SheetPreset {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
  rowCount: number;
  voice: SynthVoiceId;
  artMode: ArtModeId;
  artworkKey: 'birthday' | 'classical' | 'spooky' | 'spiral';
  cells: SheetRawGrid;
}

export interface PbtInvariantResult {
  id: string;
  name: string;
  invariant: string;
  trials: number;
  passedCount: number;
  passed: boolean;
  counterexample?: string;
}

export interface RepoAuditCheck {
  id: string;
  label: string;
  path: string;
  passed: boolean;
  detail: string;
}

export interface GitRepoStatus {
  initialized: boolean;
  gitDirExists?: boolean;
  gitDirPath?: string;
  branch: string | null;
  hasCommits: boolean;
  remoteOrigin: string | null;
  remoteLinked: boolean;
  validGithubRemoteFormat?: boolean;
  githubOwner?: string | null;
  githubRepoName?: string | null;
  licensePresent: boolean;
  licenseType: string;
  kiroStaged: boolean;
  kiroIgnored: boolean;
  kiroTrackedCount: number;
  kiroStagedPendingCount: number;
  kiroUntrackedCount: number;
  kiroTrackedFiles: string[];
}

export interface PublicRepoVerificationResult {
  isPublic: boolean;
  validGithubRepo?: boolean;
  gitDirExists?: boolean;
  owner?: string | null;
  repo?: string | null;
  normalizedUrl?: string | null;
  defaultBranch?: string;
  licenseSpdx?: string | null;
  statusCode: number;
  checkedAt?: string;
  detail: string;
}

export interface RepoAuditReport {
  allPassed: boolean;
  checkedAt: string;
  checks: RepoAuditCheck[];
  git?: GitRepoStatus;
}

export interface DemoScene {
  timestamp: string;
  scene: string;
  narration: string;
}

export interface SubmissionPack {
  socialBlitzPost: string;
  blogOutlineMd: string;
  devpostWriteupMd: string;
  demoScript: DemoScene[];
}
