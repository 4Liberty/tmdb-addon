const cacheManager = require('cache-manager');
const redisStore = require('cache-manager-ioredis');
const Redis = require('ioredis');
const { createPostgresCache } = require('./postgresCache');

const GLOBAL_KEY_PREFIX = 'tmdb-addon';
const META_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|meta`;
const CATALOG_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|catalog`;

const META_TTL = process.env.META_TTL || 7 * 24 * 60 * 60; // 7 day
const CATALOG_TTL = process.env.CATALOG_TTL || 1 * 24 * 60 * 60; // 1 day

const NO_CACHE = process.env.NO_CACHE || false;
const REDIS_URL = process.env.REDIS_URL;
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let redisInstance = null;

const cache = initiateCache();

function initiateCache() {
  const noCacheEnabled = NO_CACHE === true || String(NO_CACHE).toLowerCase() === 'true';
  if (noCacheEnabled) {
    return null;
  } else if (REDIS_URL) {
    redisInstance = new Redis(REDIS_URL);
    return cacheManager.caching({
      store: redisStore,
      redisInstance: redisInstance,
      ttl: META_TTL
    });
  } else if (DATABASE_URL) {
    return createPostgresCache({
      connectionString: DATABASE_URL,
      defaultTtlSeconds: META_TTL,
      tableName: process.env.PG_CACHE_TABLE || 'tmdb_addon_cache',
    });
  } else if (MONGODB_URI) {
    let mongoDbStore;
    try {
      ({ mongoDbStore } = require('@tirke/node-cache-manager-mongodb'));
    } catch (e) {
      // MongoDB cache is legacy and the dependency is intentionally not installed by default.
      // If a deployment still has MONGODB_URI set (common when migrating), don't hard-fail;
      // fall back to in-memory caching and emit a warning.
      //
      // If users truly want MongoDB caching, they can install the dependency and keep MONGODB_URI.
      // Otherwise, prefer REDIS_URL or DATABASE_URL.
      console.warn(
        '[tmdb-addon] MONGODB_URI is set but @tirke/node-cache-manager-mongodb is not installed. ' +
          'Falling back to in-memory cache. Remove MONGODB_URI to silence this warning, or set DATABASE_URL/REDIS_URL for persistent caching.'
      );
      return cacheManager.caching({
        store: 'memory',
        ttl: META_TTL,
      });
    }

    return cacheManager.caching(mongoDbStore, {
      url: MONGODB_URI,
      ttl: META_TTL,
    });
  } else {
    return cacheManager.caching({
      store: 'memory',
      ttl: META_TTL
    });
  }
}

function cacheWrap(key, method, options) {
  const noCacheEnabled = NO_CACHE === true || String(NO_CACHE).toLowerCase() === 'true';
  if (noCacheEnabled || !cache) {
    return method();
  }
  return cache.wrap(key, method, options);
}

function cacheWrapCatalog(id, method) {
  return cacheWrap(`${CATALOG_KEY_PREFIX}:${id}`, method, { ttl: CATALOG_TTL });
}

function cacheWrapMeta(id, method) {
  return cacheWrap(`${META_KEY_PREFIX}:${id}`, method, { ttl: META_TTL });
}

module.exports = { cacheWrapCatalog, cacheWrapMeta, cache, redisInstance };