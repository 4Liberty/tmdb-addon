const axios = require('axios');
const https = require('https');
const http = require('http');

// Proxy configuration (optional)
const PROXY_CONFIG = {
  enabled: process.env.TMDB_PROXY_ENABLED === 'true',
  host: process.env.TMDB_PROXY_HOST || '127.0.0.1',
  port: Number(process.env.TMDB_PROXY_PORT || 1080),
  protocol: process.env.TMDB_PROXY_PROTOCOL || 'http',
  auth: process.env.TMDB_PROXY_AUTH
    ? {
        username: process.env.TMDB_PROXY_USERNAME,
        password: process.env.TMDB_PROXY_PASSWORD,
      }
    : undefined,
};

// Domains that should use the proxy
const TMDB_DOMAINS = ['api.themoviedb.org', 'image.tmdb.org', 'www.themoviedb.org'];

function shouldUseProxy(url) {
  if (!PROXY_CONFIG.enabled) return false;
  try {
    const urlObj = new URL(url);
    return TMDB_DOMAINS.some((domain) => urlObj.hostname.includes(domain));
  } catch (error) {
    console.warn('Error parsing URL for proxy:', error?.message || error);
    return false;
  }
}

function createAxiosInstance(url) {
  const config = {
    timeout: 30_000,
    headers: {
      'User-Agent': 'TMDB-Addon',
    },
  };

  if (shouldUseProxy(url)) {
    const proxy = {
      host: PROXY_CONFIG.host,
      port: PROXY_CONFIG.port,
    };
    if (PROXY_CONFIG.auth) proxy.auth = PROXY_CONFIG.auth;

    // axios' proxy config doesn't accept protocol, but keeping it here helps debugging.
    proxy.protocol = PROXY_CONFIG.protocol;
    config.proxy = proxy;

    if (PROXY_CONFIG.protocol === 'https') {
      config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    } else {
      config.httpAgent = new http.Agent();
    }
  }

  return axios.create(config);
}

async function get(url, options = {}) {
  const instance = createAxiosInstance(url);
  return instance.get(url, options);
}

async function post(url, data = {}, options = {}) {
  const instance = createAxiosInstance(url);
  return instance.post(url, data, options);
}

// Best-effort proxy check. Many TMDB endpoints require an API key, so a 401 still
// proves that the proxy and network path are working.
async function testProxy() {
  if (!PROXY_CONFIG.enabled) return false;

  try {
    await get('https://api.themoviedb.org/3/configuration');
    return true;
  } catch (error) {
    // If we got an HTTP response, connectivity exists.
    if (error?.response?.status) return true;
    return false;
  }
}

module.exports = {
  get,
  post,
  shouldUseProxy,
  createAxiosInstance,
  testProxy,
  PROXY_CONFIG,
};
