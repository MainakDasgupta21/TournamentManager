import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { USER_ROLES, APPROVAL_STATUS } from '@tms/shared/constants';

/**
 * Ensure the configured seed super-admin account exists and is aligned with the
 * fixed credentials policy.
 *
 * This prevents production lockouts when a deployment starts against an empty DB
 * or when the super-admin document drifted from configured values.
 */
export async function ensureSeedSuperAdmin({ log = false } = {}) {
  const existing = await User.findOne({ email: env.seed.email }).select('+passwordHash');
  const now = new Date();

  if (!existing) {
    const user = new User({
      name: env.seed.name,
      email: env.seed.email,
      role: USER_ROLES.SUPER_ADMIN,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      approvedAt: now,
      isActive: true,
    });
    await user.setPassword(env.seed.password);
    await user.save();

    if (log) {
      console.log(`[superadmin] created: ${env.seed.email}`);
    }
    return { created: true, updated: true };
  }

  let changed = false;
  if (existing.name !== env.seed.name) {
    existing.name = env.seed.name;
    changed = true;
  }
  if (existing.role !== USER_ROLES.SUPER_ADMIN) {
    existing.role = USER_ROLES.SUPER_ADMIN;
    changed = true;
  }
  if (existing.approvalStatus !== APPROVAL_STATUS.APPROVED) {
    existing.approvalStatus = APPROVAL_STATUS.APPROVED;
    changed = true;
  }
  if (!existing.isActive) {
    existing.isActive = true;
    changed = true;
  }
  if (!existing.approvedAt) {
    existing.approvedAt = now;
    changed = true;
  }

  const hasConfiguredPassword = await existing.comparePassword(env.seed.password);
  if (!hasConfiguredPassword) {
    await existing.setPassword(env.seed.password);
    changed = true;
  }

  if (changed) {
    await existing.save();
    if (log) {
      console.log(`[superadmin] synced: ${env.seed.email}`);
    }
  } else if (log) {
    console.log(`[superadmin] already in sync: ${env.seed.email}`);
  }

  return { created: false, updated: changed };
}
