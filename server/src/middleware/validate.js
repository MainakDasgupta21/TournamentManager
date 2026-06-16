import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validates `{ body, query, params }` against a Zod schema and replaces the
 * request fields with the *parsed* (coerced + defaulted) values so controllers
 * receive clean, typed input.
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (parsed.body !== undefined) req.body = parsed.body;
    // req.query / req.params getters are read-only in Express 5 but writable
    // in Express 4; guard with try/catch so we never crash on assignment.
    if (parsed.query !== undefined) {
      try { req.query = parsed.query; } catch { /* read-only: leave as-is */ }
    }
    if (parsed.params !== undefined) {
      try { req.params = parsed.params; } catch { /* read-only */ }
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.unprocessable('Validation failed', details));
    }
    next(err);
  }
};
