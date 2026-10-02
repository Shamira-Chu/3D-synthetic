export type InfoCategory =
  | 'track'
  | 'skater'
  | 'referee'
  | 'spectator'
  | 'penalty_box'
  | 'equipment'
  | 'announcer';

export interface InfoPoint {
  id: string;
  title: string;
  shortLabel: string;
  category: InfoCategory;
  position3D: [number, number, number]; // x, y, z in Three.js arena space
  subtitle: string;
  description: string;
  wftdaRule?: string;
  tactics: string[];
  equipmentOrDetails?: { label: string; value: string }[];
  whistleCue?: 'start' | 'lead' | 'penalty' | 'calloff' | 'timeout';
  trivia: string;
  color: string;
  badge: string;
  iconName: string;
}

export interface CameraPreset {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
  lookAt: [number, number, number];
  category: string;
}

export type ViewMode = 'fps' | 'third_person' | 'drone' | 'fixed';

export interface DerbySkater {
  id: string;
  name: string;
  derbyName: string;
  number: string;
  role: 'jammer' | 'pivot' | 'blocker';
  team: 'sirens' | 'valkyries';
  trackProgress: number; // 0 to 1 around track loop
  laneOffset: number; // -1 (inner) to 1 (outer)
  speed: number;
  helmetColor: string;
  hasStar?: boolean;
  hasStripe?: boolean;
  inBox?: boolean;
  boxTimer?: number;
}

export interface DerbyReferee {
  id: string;
  name: string;
  role: 'Jam Referee' | 'Inside Pack Ref' | 'Outside Pack Ref' | 'Head Referee' | 'Penalty Box NSO';
  position: [number, number, number];
  facingAngle: number;
  armSignal?: 'lead' | 'points' | 'penalty' | 'safe';
  assignedTeam?: 'sirens' | 'valkyries';
}

export type KingsLeagueRuleId =
  | 'double_points'
  | 'duel_1v1'
  | 'instant_penalty'
  | 'super_nitro'
  | 'reverse_track'
  | 'golden_star'
  | 'reduced_2v2'
  | 'steal_lead';

export interface KingsLeagueRule {
  id: KingsLeagueRuleId;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  color: string;
  pointMultiplier: number;
  jammerSpeedMultiplier: number;
  is1v1Duel?: boolean;
  is2v2Reduced?: boolean;
  isReverse?: boolean;
  instantPenalty?: boolean;
  bonusStarPoints?: number;
}
