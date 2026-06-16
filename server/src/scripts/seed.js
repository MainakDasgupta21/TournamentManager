import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { USER_ROLES, APPROVAL_STATUS } from '@tms/shared/constants';

/**
 * Idempotent seed: ensures a super admin exists so you can log in immediately
 * after a fresh install. Credentials come from SEED_ADMIN_* env vars.
 */
async function run() {
  await connectDB();

  // Backfill accounts created before the approval workflow existed so they
  // keep working (they predate the gate and are implicitly trusted).
  const backfill = await User.updateMany(
    { approvalStatus: { $exists: false } },
    { $set: { approvalStatus: APPROVAL_STATUS.APPROVED } }
  );
  if (backfill.modifiedCount) {
    console.log(`[seed] backfilled approvalStatus=approved for ${backfill.modifiedCount} legacy user(s)`);
  }

  const existing = await User.findOne({ email: env.seed.email });
  if (existing) {
    console.log(`[seed] super admin already exists: ${env.seed.email}`);
  } else {
    const user = new User({
      name: env.seed.name,
      email: env.seed.email,
      role: USER_ROLES.SUPER_ADMIN,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      approvedAt: new Date(),
    });
    await user.setPassword(env.seed.password);
    await user.save();
    console.log('[seed] super admin created:');
    console.log(`        email:    ${env.seed.email}`);
    console.log(`        password: ${env.seed.password}`);
  }

  await disconnectDB();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
