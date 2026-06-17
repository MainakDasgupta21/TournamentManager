import { Router } from 'express';
import { schemas } from '@tms/shared';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { USER_ROLES } from '@tms/shared/constants';
import {
  signup,
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  updatePreferences,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

// Rate-limit all auth traffic to slow brute force / credential stuffing.
router.use(authLimiter);

// Public organiser self-signup. Creates a pending account (no tokens issued).
router.post('/signup', validate(schemas.signupSchema), signup);

// optionalAuth so a super admin token (if present) is recognised; the
// controller enforces who may create which role.
router.post(
  '/register',
  optionalAuth,
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(schemas.registerSchema),
  register
);

router.post('/login', validate(schemas.loginSchema), login);
router.post('/refresh', validate(schemas.refreshSchema), refresh);

// Public, enumeration-safe password recovery (rate-limited by authLimiter above).
router.post('/forgot-password', validate(schemas.forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(schemas.resetPasswordSchema), resetPassword);
// Authenticated so we can revoke outstanding refresh tokens (bump tokenVersion).
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/me', authenticate, me);

// Authenticated UI preferences (theme) — persisted server-side as the source of truth.
router.patch(
  '/preferences',
  authenticate,
  validate(schemas.updatePreferencesSchema),
  updatePreferences
);

// Authenticated self-service password change (verifies the current password).
router.post(
  '/change-password',
  authenticate,
  validate(schemas.changePasswordSchema),
  changePassword
);

export default router;
