import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Outbound email. The transporter is created lazily and cached:
 *  - If SMTP is configured (env.mail.host), real mail is sent.
 *  - Otherwise we fall back to nodemailer's jsonTransport, which never sends but
 *    lets the call succeed — and we log the message (incl. any links) to the
 *    server console. This keeps flows like password reset working in local dev
 *    or any environment that hasn't wired up SMTP yet, without leaking tokens
 *    over the API response.
 */
let transporter = null;
let usingFallback = false;

function getTransporter() {
  if (transporter) return transporter;
  if (env.mail.host) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    });
    usingFallback = false;
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    usingFallback = true;
  }
  return transporter;
}

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Send an email. Never throws back transport noise to the caller's flow logic
 *  beyond the underlying promise; callers decide how to handle failures. */
export async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  const info = await t.sendMail({ from: env.mail.from, to, subject, text, html });
  if (usingFallback) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[email] SMTP not configured — message logged, not sent:\n` +
        `  to:      ${to}\n  subject: ${subject}\n  ${text?.replace(/\n/g, '\n  ')}\n`
    );
  }
  return info;
}

/** Minimal, dependency-free HTML shell so emails render reasonably everywhere. */
function layout(title, bodyHtml) {
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h2>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  <p style="font-size:12px;color:#64748b">TourneyOps · automated message, please do not reply.</p>
</div>`;
}

/**
 * Fire-and-forget send: starts the email but never blocks the request and
 * swallows failures into a log line. Used for notifications and for the
 * password-reset email (so response timing doesn't reveal whether an account
 * exists). Pass the already-invoked send promise.
 */
export function dispatchEmail(promise, context = 'email') {
  Promise.resolve(promise).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[email] ${context} failed:`, err?.message ?? err);
  });
}

const button = (href, label) =>
  `<a href="${escapeHtml(href)}" style="background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(label)}</a>`;

/** Password-reset email with a time-limited link. */
export function sendPasswordResetEmail({ user, resetUrl, ttlMinutes }) {
  const subject = 'Reset your TourneyOps password';
  const text = `Hi ${user.name},

We received a request to reset your TourneyOps password. Open the link below within ${ttlMinutes} minutes to choose a new one:

${resetUrl}

If you didn't request this, you can safely ignore this email — your password won't change.`;
  const html = layout('Reset your password', `
    <p>Hi ${escapeHtml(user.name)},</p>
    <p>We received a request to reset your TourneyOps password. This link expires in ${ttlMinutes} minutes.</p>
    <p style="margin:20px 0">
      <a href="${escapeHtml(resetUrl)}" style="background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Reset password</a>
    </p>
    <p style="font-size:13px;color:#475569">Or paste this URL into your browser:<br /><span style="word-break:break-all">${escapeHtml(resetUrl)}</span></p>
    <p style="font-size:13px;color:#475569">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  `);
  return sendMail({ to: user.email, subject, text, html });
}

/** Notify site maintainer(s) that a new organiser is awaiting approval. */
export function sendAccessRequestEmail({ to, requester, reviewUrl }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : to;
  if (!recipients || (Array.isArray(recipients) && !recipients.length)) {
    return Promise.resolve(null);
  }
  const subject = `New organiser access request — ${requester.name}`;
  const orgLine = requester.organization ? `\nOrganization: ${requester.organization}` : '';
  const text = `A new organiser has requested access to TourneyOps.

Name: ${requester.name}
Email: ${requester.email}${orgLine}

Review pending requests: ${reviewUrl}`;
  const html = layout('New organiser access request', `
    <p>A new organiser has requested access to TourneyOps.</p>
    <ul style="padding-left:18px;color:#334155;font-size:14px;line-height:1.7">
      <li><strong>Name:</strong> ${escapeHtml(requester.name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(requester.email)}</li>
      ${requester.organization ? `<li><strong>Organization:</strong> ${escapeHtml(requester.organization)}</li>` : ''}
    </ul>
    <p style="margin:20px 0">${button(reviewUrl, 'Review requests')}</p>
  `);
  return sendMail({ to: recipients, subject, text, html });
}

/** Notify super admins about a tournament-level access request. */
export function sendTournamentAccessRequestEmail({
  to,
  requester,
  tournament,
  message,
  reviewUrl,
}) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : to;
  if (!recipients || (Array.isArray(recipients) && !recipients.length)) {
    return Promise.resolve(null);
  }
  const subject = `Tournament access request — ${requester.name} · ${tournament.name}`;
  const noteText = message ? `\n\nMessage:\n${message}` : '';
  const text = `${requester.name} requested tournament access.

Tournament: ${tournament.name}
Requester email: ${requester.email}${noteText}

Review requests: ${reviewUrl}`;
  const html = layout('New tournament access request', `
    <p>An organiser requested access to a tournament.</p>
    <ul style="padding-left:18px;color:#334155;font-size:14px;line-height:1.7">
      <li><strong>Tournament:</strong> ${escapeHtml(tournament.name)}</li>
      <li><strong>Name:</strong> ${escapeHtml(requester.name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(requester.email)}</li>
      ${message ? `<li><strong>Message:</strong> ${escapeHtml(message)}</li>` : ''}
    </ul>
    <p style="margin:20px 0">${button(reviewUrl, 'Review requests')}</p>
  `);
  return sendMail({ to: recipients, subject, text, html });
}

/** Tell an organiser whether their access request was approved or declined. */
export function sendApprovalDecisionEmail({ user, approved, note, loginUrl }) {
  const subject = approved
    ? 'Your TourneyOps account is approved'
    : 'Update on your TourneyOps access request';
  const noteText = note ? `\n\nNote from the maintainer: ${note}` : '';
  const text = approved
    ? `Hi ${user.name},

Good news — your organiser account has been approved. You can now sign in and start creating tournaments:

${loginUrl}${noteText}`
    : `Hi ${user.name},

Thanks for your interest in TourneyOps. After review, your access request was not approved at this time.${noteText}`;

  const noteHtml = note
    ? `<p style="font-size:13px;color:#475569"><strong>Note from the maintainer:</strong> ${escapeHtml(note)}</p>`
    : '';
  const html = approved
    ? layout('Your account is approved', `
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Good news — your organiser account has been approved. You can now sign in and start creating tournaments.</p>
        <p style="margin:20px 0">${button(loginUrl, 'Sign in')}</p>
        ${noteHtml}
      `)
    : layout('Access request update', `
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Thanks for your interest in TourneyOps. After review, your access request was not approved at this time.</p>
        ${noteHtml}
      `);
  return sendMail({ to: user.email, subject, text, html });
}

/** Tell the requester whether tournament-level access was granted or rejected. */
export function sendTournamentAccessDecisionEmail({ user, tournament, approved, note, adminUrl }) {
  const subject = approved
    ? `Access approved — ${tournament.name}`
    : `Access request update — ${tournament.name}`;
  const noteText = note ? `\n\nNote from the super admin: ${note}` : '';
  const text = approved
    ? `Hi ${user.name},

Your request to manage "${tournament.name}" has been approved.

Open tournament admin: ${adminUrl}${noteText}`
    : `Hi ${user.name},

Your request to manage "${tournament.name}" was not approved.${noteText}`;

  const noteHtml = note
    ? `<p style="font-size:13px;color:#475569"><strong>Note from the super admin:</strong> ${escapeHtml(note)}</p>`
    : '';
  const html = approved
    ? layout('Tournament access approved', `
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your request to manage <strong>${escapeHtml(tournament.name)}</strong> has been approved.</p>
        <p style="margin:20px 0">${button(adminUrl, 'Open tournament admin')}</p>
        ${noteHtml}
      `)
    : layout('Tournament access update', `
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your request to manage <strong>${escapeHtml(tournament.name)}</strong> was not approved.</p>
        ${noteHtml}
      `);
  return sendMail({ to: user.email, subject, text, html });
}
