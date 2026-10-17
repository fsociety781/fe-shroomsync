import config from '../config';

/**
 * Network Request Inspector & Debugging Utilities
 * Diadopsi dari FRONTEND_INTEGRATION_GUIDE.md Section "Debugging Tips".
 */

let inspectorEnabled = false;
let originalFetch = null;

export function setupNetworkInspector() {
  if (typeof window === 'undefined' || inspectorEnabled) return;

  originalFetch = window.fetch;
  window.fetch = function (...args) {
    console.log('[Network Inspector] API Call:', args[0], args[1]);
    return originalFetch.apply(this, args)
      .then((response) => {
        console.log('[Network Inspector] Response:', response.status, args[0]);
        return response;
      })
      .catch((err) => {
        console.warn('[Network Inspector] Error:', err, args[0]);
        throw err;
      });
  };

  inspectorEnabled = true;
  console.info('[Network Inspector] Enabled. All fetch calls will now be logged.');
}

export function teardownNetworkInspector() {
  if (typeof window === 'undefined' || !inspectorEnabled || !originalFetch) return;
  window.fetch = originalFetch;
  inspectorEnabled = false;
  console.info('[Network Inspector] Disabled.');
}

export async function checkRateLimit(endpoint = `${config.baseURL}/devices`) {
  try {
    const response = await fetch(endpoint);
    const info = {
      status: response.status,
      limit: response.headers.get('RateLimit-Limit'),
      remaining: response.headers.get('RateLimit-Remaining'),
      reset: response.headers.get('RateLimit-Reset'),
    };
    console.log('[Rate Limit Status]:', info);
    return info;
  } catch (error) {
    console.error('[Rate Limit Check Error]:', error);
    throw error;
  }
}

export default {
  setupNetworkInspector,
  teardownNetworkInspector,
  checkRateLimit,
};

