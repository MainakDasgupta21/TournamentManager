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

// Football-specific roster positions
export const FOOTBALL_POSITIONS = Object.freeze(['GK', 'DEF', 'MID', 'FWD']);

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
