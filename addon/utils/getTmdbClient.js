require('./loadEnv')();
const { TMDBClient } = require('./tmdbClient');

let defaultClient = null;

function getTmdbClient(config = {}) {
  const userApiKey = config?.tmdbApiKey;
  const envApiKey = process.env.TMDB_API;
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    const error = new Error('TMDB_API_KEY_MISSING');
    error.statusCode = 401;
    error.userMessage =
      'A TMDB API Key is required to use this addon. Please enter your key in the configuration page or contact the server administrator.';
    throw error;
  }

  if (userApiKey) return new TMDBClient(userApiKey);

  // Some call sites (e.g. user-specific sessionId usage) must never share a
  // singleton client instance.
  if (config?.noCacheClient === true) return new TMDBClient(envApiKey);

  if (!defaultClient) defaultClient = new TMDBClient(envApiKey);
  return defaultClient;
}

module.exports = { getTmdbClient };
