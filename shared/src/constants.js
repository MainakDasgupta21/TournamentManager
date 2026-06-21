/**
 * Domain-wide enums and constants.
 *
 * These are the single source of truth for both the API (Mongoose enums,
 * Zod validation) and the client (form options, display logic). Keeping them
 * here prevents the classic "the dropdown allows a value the backend rejects"
 * class of bug.
 */

export const SPORTS = Object.freeze({
  CRICKET: 'cricket',
  FOOTBALL: 'football',
});
export const SPORT_VALUES = Object.values(SPORTS);

export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: 'superadmin',
  TOURNAMENT_ADMIN: 'tournamentadmin',
});
export const USER_ROLE_VALUES = Object.values(USER_ROLES);

/**
 * Lifecycle of an organiser account. Self-signups start `pending` and must be
 * approved by a super admin (the site maintainer) before they can log in.
 */
export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});
export const APPROVAL_STATUS_VALUES = Object.values(APPROVAL_STATUS);

/**
 * Lifecycle of a tournament-specific access request submitted by an organiser.
 * Super admins decide whether each request is approved or rejected.
 */
export const TOURNAMENT_ACCESS_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});
export const TOURNAMENT_ACCESS_REQUEST_STATUS_VALUES = Object.values(
  TOURNAMENT_ACCESS_REQUEST_STATUS
);

export const TOURNAMENT_STATUS = Object.freeze({
  SETUP: 'setup',
  GROUP_STAGE: 'groupStage',
  KNOCKOUT_STAGE: 'knockoutStage',
  COMPLETED: 'completed',
});
export const TOURNAMENT_STATUS_VALUES = Object.values(TOURNAMENT_STATUS);

export const FIXTURE_STAGE = Object.freeze({
  GROUP: 'group',
  KNOCKOUT: 'knockout',
});
export const FIXTURE_STAGE_VALUES = Object.values(FIXTURE_STAGE);

export const FIXTURE_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  COMPLETED: 'completed',
});
export const FIXTURE_STATUS_VALUES = Object.values(FIXTURE_STATUS);

// Cricket-specific roster roles
export const CRICKET_ROLES = Object.freeze([
  'batsman',
  'bowler',
  'all-rounder',
  'wicketkeeper',
]);

// Football-specific roster positions (canonical tactical vocabulary).
export const FOOTBALL_POSITIONS = Object.freeze([
  'CF',
  'SS',
  'LWF',
  'RWF',
  'CAM',
  'DMF',
  'RMF',
  'CMF',
  'LMF',
  'LB',
  'RB',
  'LCB',
  'RCB',
  'GK',
]);

// Backward-compatible aliases from legacy and earlier detailed values.
export const FOOTBALL_POSITION_ALIASES = Object.freeze({
  DEF: 'LCB',
  MID: 'CMF',
  FWD: 'CF',
  FW: 'CF',
  ST: 'CF',
  LW: 'LWF',
  RW: 'RWF',
  LM: 'LMF',
  RM: 'RMF',
  CM: 'CMF',
  LCM: 'CMF',
  RCM: 'CMF',
  CDM: 'DMF',
  LDM: 'DMF',
  RDM: 'DMF',
  LAM: 'CAM',
  RAM: 'CAM',
  CB: 'LCB',
  LWB: 'LB',
  RWB: 'RB',
});

export const FOOTBALL_POSITION_VALUES = Object.freeze([
  ...new Set([...FOOTBALL_POSITIONS, ...Object.keys(FOOTBALL_POSITION_ALIASES)]),
]);

export const FOOTBALL_POSITION_LABELS = Object.freeze({
  CF: 'Center Forward',
  SS: 'Second Striker',
  LWF: 'Left Wing Forward',
  RWF: 'Right Wing Forward',
  CAM: 'Attacking Midfielder',
  DMF: 'Defensive Midfielder',
  RMF: 'Right Midfielder',
  CMF: 'Central Midfielder',
  LMF: 'Left Midfielder',
  LB: 'Left Back',
  RB: 'Right Back',
  LCB: 'Left Center Back',
  RCB: 'Right Center Back',
  GK: 'Goalkeeper',
});

export const FOOTBALL_POSITION_GROUPS = Object.freeze({
  GK: 'GK',
  LB: 'DEF',
  LCB: 'DEF',
  RCB: 'DEF',
  RB: 'DEF',
  DMF: 'MID',
  LMF: 'MID',
  CMF: 'MID',
  RMF: 'MID',
  CAM: 'MID',
  LWF: 'FWD',
  RWF: 'FWD',
  SS: 'FWD',
  CF: 'FWD',
});

export function normalizeFootballPosition(position) {
  const raw = typeof position === 'string' ? position.trim().toUpperCase() : '';
  if (!raw) return '';
  return FOOTBALL_POSITION_ALIASES[raw] ?? raw;
}

export function footballPositionGroup(position) {
  const normalized = normalizeFootballPosition(position);
  return FOOTBALL_POSITION_GROUPS[normalized] ?? null;
}

export function footballPositionLine(position) {
  const group = footballPositionGroup(position);
  if (group === 'GK') return 'gk';
  if (group === 'DEF') return 'def';
  if (group === 'MID') return 'mid';
  if (group === 'FWD') return 'fwd';
  return 'mid';
}

export function footballPositionLabel(position) {
  const normalized = normalizeFootballPosition(position);
  return FOOTBALL_POSITION_LABELS[normalized] ?? normalized ?? '';
}

function clampPitchPercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

/**
 * Infer tactical football position from pitch coordinates (percent values).
 * y=100 is closest to own goal, y=0 is highest attacking line.
 */
export function inferFootballPitchPosition(x, y) {
  const px = clampPitchPercent(x, 50);
  const py = clampPitchPercent(y, 50);

  if (py >= 82) return 'GK';

  if (py >= 66) {
    if (px < 28) return 'LB';
    if (px < 50) return 'LCB';
    if (px < 72) return 'RCB';
    return 'RB';
  }

  if (py >= 38) {
    const centralBand = px >= 35 && px <= 65;
    if (py >= 56 && centralBand) return 'DMF';
    if (py <= 46 && centralBand) return 'CAM';
    if (px < 30) return 'LMF';
    if (px > 70) return 'RMF';
    return 'CMF';
  }

  if (px < 32) return 'LWF';
  if (px > 68) return 'RWF';
  if (py < 20) return 'CF';
  return 'SS';
}

/**
 * Supported football formation presets. Coordinates are percentage-based pitch
 * anchors used by admin/public formation boards.
 */
export const FOOTBALL_FORMATION_PRESETS = Object.freeze({
  '4-3-3': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LB', label: 'LB', line: 'def', x: 18, y: 74 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 38, y: 76 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 62, y: 76 },
    { slot: 'RB', label: 'RB', line: 'def', x: 82, y: 74 },
    { slot: 'LCM', label: 'LCM', line: 'mid', x: 30, y: 54 },
    { slot: 'CDM', label: 'CDM', line: 'mid', x: 50, y: 58 },
    { slot: 'RCM', label: 'RCM', line: 'mid', x: 70, y: 54 },
    { slot: 'LW', label: 'LW', line: 'fwd', x: 22, y: 28 },
    { slot: 'ST', label: 'ST', line: 'fwd', x: 50, y: 18 },
    { slot: 'RW', label: 'RW', line: 'fwd', x: 78, y: 28 },
  ]),
  '4-2-3-1': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LB', label: 'LB', line: 'def', x: 18, y: 74 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 38, y: 76 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 62, y: 76 },
    { slot: 'RB', label: 'RB', line: 'def', x: 82, y: 74 },
    { slot: 'LDM', label: 'LDM', line: 'mid', x: 38, y: 58 },
    { slot: 'RDM', label: 'RDM', line: 'mid', x: 62, y: 58 },
    { slot: 'LAM', label: 'LAM', line: 'mid', x: 24, y: 40 },
    { slot: 'CAM', label: 'CAM', line: 'mid', x: 50, y: 34 },
    { slot: 'RAM', label: 'RAM', line: 'mid', x: 76, y: 40 },
    { slot: 'ST', label: 'ST', line: 'fwd', x: 50, y: 18 },
  ]),
  '4-4-2': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LB', label: 'LB', line: 'def', x: 18, y: 74 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 38, y: 76 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 62, y: 76 },
    { slot: 'RB', label: 'RB', line: 'def', x: 82, y: 74 },
    { slot: 'LM', label: 'LM', line: 'mid', x: 16, y: 50 },
    { slot: 'LCM', label: 'LCM', line: 'mid', x: 38, y: 54 },
    { slot: 'RCM', label: 'RCM', line: 'mid', x: 62, y: 54 },
    { slot: 'RM', label: 'RM', line: 'mid', x: 84, y: 50 },
    { slot: 'ST1', label: 'ST', line: 'fwd', x: 40, y: 24 },
    { slot: 'ST2', label: 'ST', line: 'fwd', x: 60, y: 24 },
  ]),
  '3-5-2': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 32, y: 77 },
    { slot: 'CB', label: 'CB', line: 'def', x: 50, y: 79 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 68, y: 77 },
    { slot: 'LWB', label: 'LWB', line: 'mid', x: 14, y: 56 },
    { slot: 'LCM', label: 'LCM', line: 'mid', x: 36, y: 53 },
    { slot: 'CDM', label: 'CDM', line: 'mid', x: 50, y: 57 },
    { slot: 'RCM', label: 'RCM', line: 'mid', x: 64, y: 53 },
    { slot: 'RWB', label: 'RWB', line: 'mid', x: 86, y: 56 },
    { slot: 'ST1', label: 'ST', line: 'fwd', x: 42, y: 24 },
    { slot: 'ST2', label: 'ST', line: 'fwd', x: 58, y: 24 },
  ]),
  '3-4-3': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 32, y: 77 },
    { slot: 'CB', label: 'CB', line: 'def', x: 50, y: 79 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 68, y: 77 },
    { slot: 'LM', label: 'LM', line: 'mid', x: 16, y: 56 },
    { slot: 'LCM', label: 'LCM', line: 'mid', x: 39, y: 55 },
    { slot: 'RCM', label: 'RCM', line: 'mid', x: 61, y: 55 },
    { slot: 'RM', label: 'RM', line: 'mid', x: 84, y: 56 },
    { slot: 'LW', label: 'LW', line: 'fwd', x: 20, y: 30 },
    { slot: 'ST', label: 'ST', line: 'fwd', x: 50, y: 20 },
    { slot: 'RW', label: 'RW', line: 'fwd', x: 80, y: 30 },
  ]),
  '4-1-4-1': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LB', label: 'LB', line: 'def', x: 18, y: 75 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 38, y: 77 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 62, y: 77 },
    { slot: 'RB', label: 'RB', line: 'def', x: 82, y: 75 },
    { slot: 'CDM', label: 'CDM', line: 'mid', x: 50, y: 62 },
    { slot: 'LM', label: 'LM', line: 'mid', x: 18, y: 48 },
    { slot: 'LCM', label: 'LCM', line: 'mid', x: 40, y: 50 },
    { slot: 'RCM', label: 'RCM', line: 'mid', x: 60, y: 50 },
    { slot: 'RM', label: 'RM', line: 'mid', x: 82, y: 48 },
    { slot: 'ST', label: 'ST', line: 'fwd', x: 50, y: 22 },
  ]),
  '4-5-1': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LB', label: 'LB', line: 'def', x: 18, y: 75 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 38, y: 77 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 62, y: 77 },
    { slot: 'RB', label: 'RB', line: 'def', x: 82, y: 75 },
    { slot: 'LM', label: 'LM', line: 'mid', x: 16, y: 55 },
    { slot: 'LDM', label: 'LDM', line: 'mid', x: 34, y: 58 },
    { slot: 'CM', label: 'CM', line: 'mid', x: 50, y: 56 },
    { slot: 'RDM', label: 'RDM', line: 'mid', x: 66, y: 58 },
    { slot: 'RM', label: 'RM', line: 'mid', x: 84, y: 55 },
    { slot: 'ST', label: 'ST', line: 'fwd', x: 50, y: 22 },
  ]),
  '5-3-2': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LWB', label: 'LWB', line: 'def', x: 12, y: 68 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 30, y: 76 },
    { slot: 'CB', label: 'CB', line: 'def', x: 50, y: 79 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 70, y: 76 },
    { slot: 'RWB', label: 'RWB', line: 'def', x: 88, y: 68 },
    { slot: 'LCM', label: 'LCM', line: 'mid', x: 36, y: 52 },
    { slot: 'CDM', label: 'CDM', line: 'mid', x: 50, y: 56 },
    { slot: 'RCM', label: 'RCM', line: 'mid', x: 64, y: 52 },
    { slot: 'ST1', label: 'ST', line: 'fwd', x: 42, y: 24 },
    { slot: 'ST2', label: 'ST', line: 'fwd', x: 58, y: 24 },
  ]),
  '5-4-1': Object.freeze([
    { slot: 'GK', label: 'GK', line: 'gk', x: 50, y: 90 },
    { slot: 'LWB', label: 'LWB', line: 'def', x: 12, y: 68 },
    { slot: 'LCB', label: 'LCB', line: 'def', x: 30, y: 76 },
    { slot: 'CB', label: 'CB', line: 'def', x: 50, y: 79 },
    { slot: 'RCB', label: 'RCB', line: 'def', x: 70, y: 76 },
    { slot: 'RWB', label: 'RWB', line: 'def', x: 88, y: 68 },
    { slot: 'LM', label: 'LM', line: 'mid', x: 18, y: 50 },
    { slot: 'LCM', label: 'LCM', line: 'mid', x: 40, y: 52 },
    { slot: 'RCM', label: 'RCM', line: 'mid', x: 60, y: 52 },
    { slot: 'RM', label: 'RM', line: 'mid', x: 82, y: 50 },
    { slot: 'ST', label: 'ST', line: 'fwd', x: 50, y: 22 },
  ]),
});
export const FOOTBALL_FORMATION_PRESET_VALUES = Object.keys(FOOTBALL_FORMATION_PRESETS);
export const FOOTBALL_FORMATION_SLOT_COUNT = 11;

/**
 * Manually-assigned player tier/category (a draft/auction-style grading), from
 * strongest to weakest. Sport-agnostic and optional — a player with no category
 * is treated as "Unrated".
 */
export const PLAYER_CATEGORIES = Object.freeze(['S++', 'S', 'A', 'B', 'C', 'D']);

/** UI theme preference. Persisted per-user in the database (not on the client). */
export const THEME_VALUES = Object.freeze(['dark', 'light']);

/**
 * Tiebreakers available per sport. The admin orders a subset of these in
 * `pointsConfig.tiebreakerOrder`; the standings engine applies them in order.
 */
export const TIEBREAKERS = Object.freeze({
  [SPORTS.CRICKET]: ['netRunRate', 'headToHead', 'totalWins'],
  [SPORTS.FOOTBALL]: ['goalDifference', 'goalsScored', 'headToHead'],
});

export const CRICKET_RESULT_TYPES = Object.freeze({
  RUNS: 'runs',
  WICKETS: 'wickets',
  TIE: 'tie',
  NO_RESULT: 'noResult',
});

export const CARD_TYPES = Object.freeze(['yellow', 'red']);

/* ----------------------- Granular match events (Module 5) ----------------------- */

/**
 * Cricket extras. `wide`/`noball` cost the bowling side and (for wide) are not a
 * legal delivery; `bye`/`legbye` are legal deliveries not charged to the bowler.
 */
export const CRICKET_EXTRA_TYPES = Object.freeze(['wide', 'noball', 'bye', 'legbye', 'penalty']);

/** Cricket dismissal types. `bowlerCredited` distinguishes run-outs etc. */
export const CRICKET_WICKET_TYPES = Object.freeze([
  'bowled',
  'caught',
  'lbw',
  'runout',
  'stumped',
  'hitwicket',
  'other',
]);

/** Football goal kinds — used for stats (own goals are not credited to scorer). */
export const FOOTBALL_GOAL_TYPES = Object.freeze(['openPlay', 'penalty', 'freeKick', 'ownGoal']);

/* ----------------------- Audit trail (Module 5B) ----------------------- */

/** What kind of entity an audit-log entry concerns. */
export const AUDIT_ENTITY = Object.freeze({
  FIXTURE: 'fixture',
  RESULT: 'result',
  EVENT: 'event',
  POINTS_CONFIG: 'pointsConfig',
  KNOCKOUT: 'knockout',
  TOURNAMENT: 'tournament',
  STANDINGS: 'standings',
});
export const AUDIT_ENTITY_VALUES = Object.values(AUDIT_ENTITY);

/** The kind of change an audit-log entry records. */
export const AUDIT_ACTION = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RECALCULATE: 'recalculate',
  REOPEN: 'reopen',
});
export const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTION);

export const KNOCKOUT_ROUND_NAMES = Object.freeze({
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarterfinals',
  SEMI_FINAL: 'Semifinals',
  FINAL: 'Final',
  THIRD_PLACE: 'Third-place playoff',
});

/** Default points configuration suggestions keyed by sport. */
export const DEFAULT_POINTS_CONFIG = Object.freeze({
  [SPORTS.CRICKET]: {
    win: 2,
    draw: 1,
    loss: 0,
    noResult: 1,
    bonusPointRule: { enabled: false, description: '', bonusPoints: 0 },
    tiebreakerOrder: ['netRunRate', 'headToHead', 'totalWins'],
  },
  [SPORTS.FOOTBALL]: {
    win: 3,
    draw: 1,
    loss: 0,
    noResult: 0,
    bonusPointRule: { enabled: false, description: '', bonusPoints: 0 },
    tiebreakerOrder: ['goalDifference', 'goalsScored', 'headToHead'],
  },
});
