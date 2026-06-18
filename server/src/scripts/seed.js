import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { APPROVAL_STATUS } from '@tms/shared/constants';
import { ensureSeedSuperAdmin } from '../services/superAdminService.js';

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

  await ensureSeedSuperAdmin({ log: true });

  await disconnectDB();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
