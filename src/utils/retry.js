/**
 * Exponential Backoff Retry Utility
 * Diadopsi dari FRONTEND_INTEGRATION_GUIDE.md Section 6.
 *
 * @param {Function} fn - Async task yang akan dieksekusi
 * @param {number} maxRetries - Maksimal percobaan ulang (default: 3)
 * @param {number} initialDelay - Delay awal dalam ms (default: 1000)
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(
  fn,
  maxRetries = 3,
  initialDelay = 1000
) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Periksa apakah error rate limit (429) atau error sementara
      const isRateLimited = error?.statusCode === 429 || error?.status === 429;
      if (isRateLimited && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`[retryWithBackoff] Rate limited (429), retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

export default retryWithBackoff;

