const { cache, redisInstance } = require('../lib/getCache');
const crypto = require('crypto');
const os = require('os');
const https = require('https');
const http = require('http');

const memoryCache = new Map();
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

const USER_COUNT_KEY = 'tmdb-addon:unique-users';
const USER_IPS_KEY = 'tmdb-addon:user-ips';

const OFFICIAL_INSTANCE_URL =
  process.env.OFFICIAL_INSTANCE_URL ||
  'https://94c8cb9f702d-tmdb-addon.baby-beamup.club';

function getInstanceId() {
  const hostName = process.env.HOST_NAME || '';
  if (hostName) {
    try {
      const url = new URL(hostName);
      return url.hostname.replace(/\./g, '-');
    } catch {
      return hostName.replace(/[^a-zA-Z0-9]/g, '-');
    }
  }
  return os.hostname().replace(/\./g, '-');
}

const INSTANCE_ID = getInstanceId();

function isOfficialInstance() {
  const hostName = process.env.HOST_NAME || '';
  if (!hostName) return false;

  try {
    const currentUrl = new URL(hostName);
    const officialUrl = new URL(OFFICIAL_INSTANCE_URL);
    return currentUrl.hostname === officialUrl.hostname;
  } catch {
    return hostName.includes('94c8cb9f702d-tmdb-addon.baby-beamup.club');
  }
}

function hashIP(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];

  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;

  return req.ip || req.connection?.remoteAddress || 'unknown';
}

async function incrementUserCount() {
  try {
    if (cache) {
      const current = (await cache.get(USER_COUNT_KEY)) || '0';
      const newCount = Number.parseInt(current, 10) + 1;
      await cache.set(USER_COUNT_KEY, String(newCount), { ttl: 365 * 24 * 60 * 60 });
      return;
    }

    const current = memoryCache.get(USER_COUNT_KEY) || 0;
    memoryCache.set(USER_COUNT_KEY, current + 1);
  } catch (error) {
    console.error('Error incrementing user count:', error?.message || error);
  }
}

async function trackUser(req) {
  const ip = getClientIP(req);
  if (!ip || ip === 'unknown') return false;

  const ipHash = hashIP(ip);
  const today = new Date().toISOString().split('T')[0];
  const key = `${USER_IPS_KEY}:${today}:${ipHash}`;

  try {
    if (cache) {
      const exists = await cache.get(key);
      if (!exists) {
        await cache.set(key, '1', { ttl: 24 * 60 * 60 });
        await incrementUserCount();
        return true;
      }
      return false;
    }

    if (!memoryCache.has(key)) {
      memoryCache.set(key, Date.now());
      setTimeout(() => memoryCache.delete(key), MEMORY_TTL_MS);
      await incrementUserCount();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error tracking user:', error?.message || error);
    return false;
  }
}

async function getUserCount() {
  try {
    if (cache) {
      const count = await cache.get(USER_COUNT_KEY);
      return Number.parseInt(count || '0', 10);
    }
    return memoryCache.get(USER_COUNT_KEY) || 0;
  } catch (error) {
    console.error('Error getting user count:', error?.message || error);
    return 0;
  }
}

async function trackExternalUsers(count, instanceId) {
  if (!count || count <= 0 || !instanceId) return;

  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `${USER_COUNT_KEY}:external:${instanceId}:${today}`;
  const instanceCountKey = `${USER_COUNT_KEY}:external-count:${instanceId}`;
  const activeInstancesKey = `${USER_COUNT_KEY}:active-instances`;

  try {
    if (cache) {
      await cache.set(dailyKey, String(count), { ttl: 7 * 24 * 60 * 60 });
      await cache.set(instanceCountKey, String(count), { ttl: 2 * 24 * 60 * 60 });

      if (redisInstance && typeof redisInstance.sadd === 'function') {
        await redisInstance.sadd(activeInstancesKey, instanceId);
        await redisInstance.expire(activeInstancesKey, 2 * 24 * 60 * 60);
      }
      return;
    }

    memoryCache.set(dailyKey, count);
    memoryCache.set(instanceCountKey, count);

    if (!memoryCache.has(activeInstancesKey)) memoryCache.set(activeInstancesKey, new Set());
    memoryCache.get(activeInstancesKey).add(instanceId);
  } catch (error) {
    console.error('Error tracking external users:', error?.message || error);
  }
}

async function getAggregatedUserCount() {
  const baseCount = await getUserCount();
  if (!isOfficialInstance()) return baseCount;

  let aggregatedCount = baseCount;

  try {
    const activeInstancesKey = `${USER_COUNT_KEY}:active-instances`;

    if (redisInstance && typeof redisInstance.smembers === 'function' && cache) {
      const instanceIds = await redisInstance.smembers(activeInstancesKey);
      for (const instanceId of instanceIds) {
        const instanceCountKey = `${USER_COUNT_KEY}:external-count:${instanceId}`;
        const count = await cache.get(instanceCountKey);
        if (count) aggregatedCount += Number.parseInt(count, 10);
      }
    } else if (!cache) {
      const instanceSet = memoryCache.get(activeInstancesKey);
      if (instanceSet && instanceSet instanceof Set) {
        for (const instanceId of instanceSet) {
          const instanceCountKey = `${USER_COUNT_KEY}:external-count:${instanceId}`;
          const count = memoryCache.get(instanceCountKey);
          if (count) aggregatedCount += Number.parseInt(String(count), 10);
        }
      }
    }
  } catch (error) {
    console.error('Error aggregating external counts:', error?.message || error);
  }

  return aggregatedCount;
}

async function reportToOfficialInstance() {
  if (isOfficialInstance()) return false;

  try {
    const count = await getUserCount();
    if (!count) return false;

    const reportUrl = `${OFFICIAL_INSTANCE_URL}/api/stats/report-users`;
    const url = new URL(reportUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const postData = JSON.stringify({ count, instanceId: INSTANCE_ID });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'tmdb-addon-user-counter/1.0',
      },
      timeout: 5000,
    };

    return await new Promise((resolve) => {
      const req = httpModule.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.write(postData);
      req.end();
    });
  } catch {
    return false;
  }
}

let reportInterval = null;

function startAutoReporting(intervalMinutes = 60) {
  if (reportInterval) return;
  if (isOfficialInstance()) return;

  reportToOfficialInstance().catch(() => {});

  reportInterval = setInterval(() => {
    reportToOfficialInstance().catch(() => {});
  }, intervalMinutes * 60 * 1000);
}

function stopAutoReporting() {
  if (!reportInterval) return;
  clearInterval(reportInterval);
  reportInterval = null;
}

module.exports = {
  trackUser,
  getUserCount,
  getAggregatedUserCount,
  trackExternalUsers,
  getClientIP,
  reportToOfficialInstance,
  startAutoReporting,
  stopAutoReporting,
  isOfficialInstance,
  INSTANCE_ID,
};
