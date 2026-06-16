import { AuditLog } from '../models/AuditLog.js';

/**
 * Audit trail writer (Module 5B). Recording an audit entry must never break the
 * primary mutation, so failures are swallowed (and logged) rather than thrown.
 *
 * @param {object} args
 * @param {object} args.tournament  req.tournament (or a tournament id)
 * @param {object} args.user        req.user (optional)
 * @param {string} args.entityType  one of AUDIT_ENTITY
 * @param {*}      args.entityId
 * @param {string} args.action      one of AUDIT_ACTION
 * @param {string} [args.summary]
 * @param {*}      [args.before]
 * @param {*}      [args.after]
 * @param {*}      [args.meta]
 */
export async function recordAudit({
  tournament,
  user,
  entityType,
  entityId = null,
  action,
  summary = '',
  before = null,
  after = null,
  meta = null,
}) {
  try {
    const tournamentId = tournament?._id ?? tournament;
    await AuditLog.create({
      tournamentId,
      editedBy: user?._id ?? null,
      editedByName: user?.name ?? '',
      entityType,
      entityId,
      action,
      summary,
      before,
      after,
      meta,
    });
  } catch (err) {
    // Audit is best-effort; never surface to the caller.
    console.error('[audit] failed to record entry:', err.message);
  }
}

/** Paginated, newest-first audit log for a tournament (admin dashboard). */
export async function listAuditLogs(tournamentId, { page = 1, limit = 25, entityType } = {}) {
  const filter = { tournamentId };
  if (entityType) filter.entityType = entityType;

  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.ceil(total / safeLimit) || 1,
  };
}
