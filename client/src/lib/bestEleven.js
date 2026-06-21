/**
 * Team of the Tournament (Module 8). Auto-picks a balanced best XI from the
 * cached player stats, fully client-side and transparent:
 *   - Cricket: 4 batters, 2 all-rounders, 1 wicketkeeper, 4 bowlers.
 *   - Football: a 4-3-3 (1 GK, 4 DEF, 3 MID, 3 FWD), with detailed roles
 *     mapped into these tactical lines.
 * Role slots are filled by the relevant score; any short-fall is topped up from
 * the best remaining performers so we always return up to 11.
 */

import { footballPositionGroup, normalizeFootballPosition } from '@tms/shared/constants';

const round = (n, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)) : 0);

function project(p) {
  const team = p.teamId && typeof p.teamId === 'object' ? p.teamId : null;
  return {
    _id: String(p._id),
    name: p.name,
    role: p.role,
    jerseyNumber: p.jerseyNumber,
    team,
  };
}

/* ------------------------------- Cricket -------------------------------- */

function cricketCandidate(p) {
  const c = p.stats?.cricket ?? {};
  const runs = c.runs ?? 0;
  const ballsFaced = c.ballsFaced ?? 0;
  const wickets = c.wickets ?? 0;
  const ballsBowled = c.ballsBowled ?? 0;
  const runsConceded = c.runsConceded ?? 0;
  const sixes = c.sixes ?? 0;
  const fours = c.fours ?? 0;
  const matches = c.matches ?? 0;

  const strikeRate = ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0;
  const economy = ballsBowled > 0 ? runsConceded / (ballsBowled / 6) : 0;
  const batScore = runs + sixes * 4 + fours * 2 + strikeRate / 5;
  const bowlScore = wickets * 25 + (ballsBowled > 0 ? Math.max(0, 8 - economy) * 6 : 0);

  return {
    player: project(p),
    matches,
    played: matches > 0 || runs > 0 || wickets > 0 || ballsFaced > 0 || ballsBowled > 0,
    runs, wickets, sixes, fours, strikeRate: round(strikeRate), economy: round(economy, 2),
    batScore, bowlScore, impact: batScore + bowlScore,
  };
}

function cricketReason(c, slot) {
  if (slot === 'Bowler') return `${c.wickets} wkt${c.wickets === 1 ? '' : 's'}`;
  if (slot === 'All-rounder') return `${c.runs} runs · ${c.wickets} wkt${c.wickets === 1 ? '' : 's'}`;
  return `${c.runs} runs${c.strikeRate ? ` · SR ${c.strikeRate}` : ''}`;
}

function bestElevenCricket(players) {
  const pool = players.map(cricketCandidate).filter((c) => c.played);
  const taken = new Set();
  const picked = [];

  const grab = (slot, n, eligible, scoreKey) => {
    const ranked = pool
      .filter((c) => !taken.has(c.player._id) && eligible(c))
      .sort((a, b) => b[scoreKey] - a[scoreKey]);
    for (const c of ranked.slice(0, n)) {
      taken.add(c.player._id);
      picked.push({ ...c.player, slot, reason: cricketReason(c, slot), _impact: c.impact });
    }
  };

  grab('Wicketkeeper', 1, (c) => c.player.role === 'wicketkeeper', 'batScore');
  grab('Batter', 4, (c) => c.player.role === 'batsman', 'batScore');
  grab('All-rounder', 2, (c) => c.player.role === 'all-rounder', 'impact');
  grab('Bowler', 4, (c) => c.player.role === 'bowler', 'bowlScore');

  // Top up to 11 from whoever's left, by overall impact.
  if (picked.length < 11) {
    const rest = pool
      .filter((c) => !taken.has(c.player._id))
      .sort((a, b) => b.impact - a.impact);
    for (const c of rest) {
      if (picked.length >= 11) break;
      taken.add(c.player._id);
      const slot = c.bowlScore > c.batScore ? 'Bowler' : 'Batter';
      picked.push({ ...c.player, slot, reason: cricketReason(c, slot), _impact: c.impact });
    }
  }

  return { formation: '4 bat · 2 all · 1 wk · 4 bowl', players: orderCricket(picked) };
}

const CRICKET_ORDER = { Batter: 0, 'All-rounder': 1, Wicketkeeper: 2, Bowler: 3 };
function orderCricket(list) {
  return [...list].sort((a, b) => (CRICKET_ORDER[a.slot] - CRICKET_ORDER[b.slot]) || b._impact - a._impact);
}

/* ------------------------------- Football ------------------------------- */

function footballCandidate(p) {
  const normalizedRole = normalizeFootballPosition(p.role);
  const roleGroup = footballPositionGroup(normalizedRole);
  const f = p.stats?.football ?? {};
  const goals = f.goals ?? 0;
  const assists = f.assists ?? 0;
  const appearances = f.appearances ?? 0;
  const cleanSheets = f.cleanSheets ?? 0;
  const yellow = f.yellowCards ?? 0;
  const red = f.redCards ?? 0;
  const conceded = f.goalsConcededByTeam ?? 0;

  const discipline = yellow * 0.5 + red * 3;
  const attack = goals * 4 + assists * 3 + appearances * 0.6 - discipline;
  const defScore = cleanSheets * 4 + appearances * 0.8 + goals * 2 + assists * 1.5 - discipline;
  const gkScore = cleanSheets * 5 + appearances - conceded * 0.5 - discipline;

  return {
    player: { ...project(p), role: normalizedRole || p.role },
    roleGroup,
    played: appearances > 0 || goals > 0 || assists > 0 || cleanSheets > 0,
    goals, assists, appearances, cleanSheets,
    attack, defScore, gkScore, impact: attack,
  };
}

function footballReason(c, slot) {
  if (slot === 'GK') return `${c.cleanSheets} clean sheet${c.cleanSheets === 1 ? '' : 's'}`;
  const bits = [];
  if (c.goals) bits.push(`${c.goals}G`);
  if (c.assists) bits.push(`${c.assists}A`);
  if (!bits.length) bits.push(`${c.appearances} app${c.appearances === 1 ? '' : 's'}`);
  return bits.join(' · ');
}

function bestElevenFootball(players) {
  const pool = players.map(footballCandidate).filter((c) => c.played);
  const taken = new Set();
  const picked = [];

  const grab = (slot, n, roleGroup, scoreKey) => {
    const ranked = pool
      .filter((c) => !taken.has(c.player._id) && c.roleGroup === roleGroup)
      .sort((a, b) => b[scoreKey] - a[scoreKey]);
    for (const c of ranked.slice(0, n)) {
      taken.add(c.player._id);
      picked.push({ ...c.player, slot, reason: footballReason(c, slot), _impact: c[scoreKey] });
    }
  };

  grab('GK', 1, 'GK', 'gkScore');
  grab('DEF', 4, 'DEF', 'defScore');
  grab('MID', 3, 'MID', 'attack');
  grab('FWD', 3, 'FWD', 'attack');

  if (picked.length < 11) {
    const rest = pool
      .filter((c) => !taken.has(c.player._id))
      .sort((a, b) => b.attack - a.attack);
    for (const c of rest) {
      if (picked.length >= 11) break;
      taken.add(c.player._id);
      const slot = c.roleGroup || 'MID';
      picked.push({ ...c.player, slot, reason: footballReason(c, slot), _impact: c.attack });
    }
  }

  return { formation: '4-3-3', players: orderFootball(picked) };
}

const FOOTBALL_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
function orderFootball(list) {
  return [...list].sort((a, b) => (FOOTBALL_ORDER[a.slot] - FOOTBALL_ORDER[b.slot]) || b._impact - a._impact);
}

/* ------------------------------ Entry point ----------------------------- */

/**
 * @param {'cricket'|'football'} sport
 * @param {Array} players  roster with cached `stats`
 * @returns {{ formation:string, players:Array<{_id,name,slot,reason,team}> } | null}
 */
export function bestEleven(sport, players = []) {
  const usable = players.filter((p) => p && p._id);
  if (!usable.length) return null;
  const result = sport === 'cricket' ? bestElevenCricket(usable) : bestElevenFootball(usable);
  return result.players.length ? result : null;
}
