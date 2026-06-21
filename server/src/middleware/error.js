import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { isZodError, formatZodIssues } from '../utils/zodError.js';
import { env } from '../config/env.js';

/** 404 handler for unmatched routes. */
export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Normalises Zod, Mongoose, and JWT errors into the
 * standard `{ success: false, error }` envelope and hides stack traces in prod.
 */
// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode ?? 500;
  let message = err.message ?? 'Internal server error';
  let details = err.details;

  if (isZodError(err)) {
    statusCode = 422;
    message = 'Validation failed';
    details = formatZodIssues(err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    // Duplicate key. Report only the field name(s); echoing back the conflicting
    // value (err.keyValue) would leak data (e.g. which emails are registered).
    statusCode = 409;
    const fields = Object.keys(err.keyValue ?? {});
    const field = fields.join(', ');
    message = `Duplicate value for: ${field || 'unique field'}`;
    console.warn('[duplicate-key]', fields);
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  if (statusCode >= 500) {
    // Log primitive strings only. Passing the raw error object to console.error
    // routes it through util.inspect(), which can itself throw on unusual error
    // shapes — that would crash this handler and leak a default HTML stack trace.
    try {
      console.error('[error]', String(err?.stack || err?.message || err));
    } catch {
      console.error('[error] (unprintable error object)');
    }
  }

  const error = { message };
  if (details) error.details = details;
  if (!env.isProd && statusCode >= 500) error.stack = err.stack;

  res.status(statusCode).json({ success: false, error });
}
