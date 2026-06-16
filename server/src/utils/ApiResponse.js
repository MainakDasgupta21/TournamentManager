/**
 * Consistent success envelope. Every endpoint returns:
 *   { success: true, message, data }
 * Errors are shaped by the error middleware as:
 *   { success: false, error: { message, details? } }
 */
export function sendSuccess(res, { status = 200, message = 'OK', data = null, meta } = {}) {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(status).json(payload);
}

export function sendCreated(res, opts = {}) {
  return sendSuccess(res, { status: 201, message: 'Created', ...opts });
}
