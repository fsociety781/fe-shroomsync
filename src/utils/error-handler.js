import { APIError } from '../services/api-client';

/**
 * Utility error handler based on FRONTEND_INTEGRATION_GUIDE.md
 */

export { APIError };

export function formatFormErrors(errors) {
  if (!Array.isArray(errors)) return {};
  return errors.reduce((acc, err) => {
    if (err?.field) acc[err.field] = err.message;
    return acc;
  }, {});
}

export function getErrorMessage(error, fallback = 'Terjadi kesalahan sistem.') {
  if (!error) return fallback;
  if (error instanceof APIError && typeof error.getUserMessage === 'function') {
    return error.getUserMessage();
  }
  return error.message || fallback;
}

export default APIError;

