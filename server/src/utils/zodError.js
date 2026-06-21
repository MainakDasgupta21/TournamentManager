/**
 * Structural ZodError detection.
 *
 * In this monorepo the validation schemas live in `@tms/shared`, which resolves
 * its own copy of `zod`. If the server also imported `zod` directly, an
 * `instanceof ZodError` check here would compare against a *different* class
 * identity than the error actually thrown by the shared schemas and silently
 * return `false` — causing every validation failure to fall through to the
 * generic 500 handler. Detecting the error by shape instead of by identity is
 * immune to duplicate module instances.
 */
export function isZodError(err) {
  return (
    !!err &&
    (err.name === 'ZodError' || err.constructor?.name === 'ZodError') &&
    Array.isArray(err.issues)
  );
}

/** Normalise Zod issues into the API's `{ path, message }` detail shape. */
export function formatZodIssues(err) {
  return (err.issues ?? []).map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? ''),
    message: issue.message,
  }));
}
