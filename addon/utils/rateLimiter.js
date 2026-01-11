const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedMap(items, fn, options = {}) {
  const { batchSize = DEFAULT_BATCH_SIZE, delayMs = DEFAULT_DELAY_MS } = options;
  if (!items || items.length === 0) return [];

  const results = new Array(items.length);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchStartIndex = i;

    const batchPromises = batch.map((item, batchIndex) => {
      const globalIndex = batchStartIndex + batchIndex;
      return fn(item, globalIndex)
        .then((result) => {
          results[globalIndex] = result;
          return result;
        })
        .catch((error) => {
          console.error(
            `Rate limited operation failed for item at index ${globalIndex}:`,
            error?.message || error
          );
          results[globalIndex] = null;
          return null;
        });
    });

    await Promise.all(batchPromises);

    if (i + batchSize < items.length) await sleep(delayMs);
  }

  return results;
}

async function rateLimitedMapFiltered(items, fn, options = {}) {
  const results = await rateLimitedMap(items, fn, options);
  return results.filter(Boolean);
}

async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    shouldRetry,
    operationName,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const status = error?.response?.status ?? error?.status;
      const message = error?.error?.message || error?.message || '';

      const is429 = status === 429 || message.includes('429');
      const is400 = status === 400;

      const retryMatch = message.match(/Please retry in ([\d.]+)s/i);
      const suggestedDelayMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : null;

      const shouldRetryError = shouldRetry ? shouldRetry(error) : is429;

      if (is400 && !shouldRetry) throw error;

      if (shouldRetryError && attempt < maxRetries) {
        const delayMs = suggestedDelayMs || baseDelayMs * Math.pow(2, attempt);
        const opName = operationName ? ` (${operationName})` : '';
        await sleep(delayMs);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

module.exports = {
  rateLimitedMap,
  rateLimitedMapFiltered,
  withRetry,
  sleep,
  DEFAULT_BATCH_SIZE,
  DEFAULT_DELAY_MS,
};
