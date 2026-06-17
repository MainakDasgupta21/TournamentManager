import { z } from 'zod';
import { USER_ROLE_VALUES, USER_ROLES, THEME_VALUES } from '../constants.js';
import { nonEmptyString } from './common.js';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * Public self-signup for tournament organisers. Creates a `pending` account
 * that a super admin must approve before login is permitted. Role is always
 * tournamentadmin here (never accepted from the client).
 */
export const signupSchema = z.object({
  body: z.object({
    name: nonEmptyString.max(120),
    email: z.string().trim().toLowerCase().email(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128),
    organization: z.string().trim().max(160).optional(),
  }),
});

/**
 * Registration is performed by a super admin to create accounts. Role defaults
 * to tournamentadmin; only a super admin may mint another super admin (enforced
 * in the controller, not the schema).
 */
export const registerSchema = z.object({
  body: z.object({
    name: nonEmptyString.max(120),
    email: z.string().trim().toLowerCase().email(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128),
    role: z.enum(USER_ROLE_VALUES).default(USER_ROLES.TOURNAMENT_ADMIN),
  }),
});

export const refreshSchema = z.object({
  // Refresh token may arrive via httpOnly cookie or body; both optional here.
  body: z.object({ refreshToken: z.string().optional() }).optional(),
});

/** Request a password-reset link. Always answered generically (no enumeration). */
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
  }),
});

/** Complete a password reset with the emailed single-use token. */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128),
  }),
});

/**
 * Authenticated self-service password change. The current password is verified
 * server-side; the new password must meet the same strength bar as signup and
 * differ from the current one.
 */
export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128),
    })
    .refine((d) => d.newPassword !== d.currentPassword, {
      message: 'New password must be different from your current password',
      path: ['newPassword'],
    }),
});

/** Authenticated update of the signed-in user's UI preferences (e.g. theme). */
export const updatePreferencesSchema = z.object({
  body: z.object({
    theme: z.enum(THEME_VALUES),
  }),
});
