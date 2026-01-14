const { Pool } = require('pg');

const DEFAULT_TABLE = 'tmdb_addon_cache';

function toBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v !== 'string') return false;
  return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes';
}

function toInt(v, fallback) {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function createPostgresCache({ connectionString, defaultTtlSeconds, tableName = DEFAULT_TABLE }) {
  if (!connectionString) {
    throw new Error('Postgres cache requires connectionString');
  }

  const sslEnabled =
    toBool(process.env.PG_SSL) ||
    String(process.env.PGSSLMODE || '').toLowerCase() === 'require' ||
    String(process.env.PGSSLMODE || '').toLowerCase() === 'prefer';

  const pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  let initPromise = null;

  async function ensureInit() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${tableName} (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS ${tableName}_expires_at_idx ON ${tableName} (expires_at);`);
      } finally {
        client.release();
      }
    })();

    return initPromise;
  }

  async function cleanupExpired(limit = 500) {
    try {
      await ensureInit();
      await pool.query(
        `DELETE FROM ${tableName} WHERE key IN (
          SELECT key FROM ${tableName} WHERE expires_at <= NOW() LIMIT $1
        )`,
        [limit]
      );
    } catch {
      // Best-effort cleanup; ignore.
    }
  }

  async function get(key) {
    await ensureInit();

    const res = await pool.query(
      `SELECT value, expires_at FROM ${tableName} WHERE key = $1`,
      [key]
    );

    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      // Expired: delete and behave like a miss.
      await pool.query(`DELETE FROM ${tableName} WHERE key = $1`, [key]);
      return null;
    }

    return row.value;
  }

  async function set(key, value, options = {}) {
    await ensureInit();

    const ttlSeconds = toInt(options.ttl, toInt(defaultTtlSeconds, 0));
    const expiresAt = new Date(Date.now() + Math.max(0, ttlSeconds) * 1000);

    await pool.query(
      `INSERT INTO ${tableName} (key, value, expires_at, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
      [key, JSON.stringify(value), expiresAt.toISOString()]
    );

    // Opportunistic cleanup to avoid unbounded growth.
    if (Math.random() < 0.01) {
      cleanupExpired().catch(() => {});
    }
  }

  async function del(key) {
    await ensureInit();
    await pool.query(`DELETE FROM ${tableName} WHERE key = $1`, [key]);
  }

  async function reset() {
    await ensureInit();
    await pool.query(`TRUNCATE TABLE ${tableName}`);
  }

  async function wrap(key, fn, options = {}) {
    const cached = await get(key);
    if (cached !== null && cached !== undefined) return cached;

    const value = await fn();
    try {
      await set(key, value, options);
    } catch {
      // If cache write fails, still return computed value.
    }
    return value;
  }

  async function close() {
    await pool.end();
  }

  return {
    get,
    set,
    del,
    reset,
    wrap,
    close,
  };
}

module.exports = { createPostgresCache };
