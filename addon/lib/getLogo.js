require('dotenv').config();
const FanartTvApi = require("fanart.tv-api");

let fanartClient;
function resolveFanartApiKey(config) {
  return (
    config?.fanartApiKey ||
    config?.fanart_api_key ||
    config?.fanartKey ||
    config?.fanart_key ||
    process.env.FANART_API ||
    process.env.FANART_API_KEY ||
    process.env.FANARTTV_API_KEY
  );
}

function createFanartClient(apiKey) {
  const baseUrl = process.env.FANART_BASE_URL || "http://webservice.fanart.tv/v3/";
  try {
    return new FanartTvApi({ apiKey, baseUrl });
  } catch (err) {
    console.warn(
      `[fanart] Failed to initialize Fanart client; continuing without it: ${err?.message || err}`
    );
    return null;
  }
}

function getFanartClient(config) {
  const apiKey = resolveFanartApiKey(config);
  if (!apiKey) return null;

  // Cache only the env-based client; config-provided keys are per-user.
  const isEnvKey =
    apiKey === process.env.FANART_API ||
    apiKey === process.env.FANART_API_KEY ||
    apiKey === process.env.FANARTTV_API_KEY;

  if (!isEnvKey) return createFanartClient(apiKey);

  if (fanartClient !== undefined) return fanartClient;
  fanartClient = createFanartClient(apiKey);
  return fanartClient;
}

const { getTmdbClient } = require("../utils/getTmdbClient");

function pickLogo(logos, language, originalLanguage) {
  const lang = language.split("-")[0];

  return (
    logos.find(l => l.lang === lang) ||
    logos.find(l => l.lang === originalLanguage) ||
    logos.find(l => l.lang === "en") ||
    logos[0]
  );
}

async function getLogo(tmdbId, language, originalLanguage, config = null) {
  if (!tmdbId) {
    throw new Error(`TMDB ID not available for logo: ${tmdbId}`);
  }

  const moviedb = getTmdbClient(config || undefined);
  const fanart = getFanartClient(config);

  const [fanartRes, tmdbRes] = await Promise.all([
    fanart
      ? fanart
          .getMovieImages(tmdbId)
          .then(res => res.hdmovielogo || [])
          .catch(() => [])
      : Promise.resolve([]),

    moviedb
      .movieImages({ id: tmdbId })
      .then(res => res.logos || [])
      .catch(() => [])
  ]);

  const fanartLogos = fanartRes.map(l => ({
    url: l.url,
    lang: l.lang || 'en',
    source: 'fanart'
  }));

  const tmdbLogos = tmdbRes.map(l => ({
    url: `https://image.tmdb.org/t/p/original${l.file_path}`,
    lang: l.iso_639_1 || 'en',
    source: 'tmdb'
  }));

  const combined = [...fanartLogos, ...tmdbLogos];

  if (combined.length === 0) return '';

  const picked = pickLogo(combined, language, originalLanguage);
  return picked?.url || '';
}

async function getTvLogo(tvdb_id, tmdbId, language, originalLanguage, config = null) {
  if (!tvdb_id && !tmdbId) {
    throw new Error(`TVDB ID and TMDB ID not available for logos.`);
  }

  const moviedb = getTmdbClient(config || undefined);
  const fanart = getFanartClient(config);

  const [fanartRes, tmdbRes] = await Promise.all([
    tvdb_id && fanart
      ? fanart
          .getShowImages(tvdb_id)
          .then(res => res.hdtvlogo || [])
          .catch(() => [])
      : Promise.resolve([]),

    tmdbId
      ? moviedb
          .tvImages({ id: tmdbId })
          .then(res => res.logos || [])
          .catch(() => [])
      : Promise.resolve([])
  ]);

  const fanartLogos = fanartRes.map(l => ({
    url: l.url,
    lang: l.lang || 'en',
    source: 'fanart'
  }));

  const tmdbLogos = tmdbRes.map(l => ({
    url: `https://image.tmdb.org/t/p/original${l.file_path}`,
    lang: l.iso_639_1 || 'en',
    source: 'tmdb'
  }));

  const combined = [...fanartLogos, ...tmdbLogos];

  if (combined.length === 0) return '';

  const picked = pickLogo(combined, language, originalLanguage);
  return picked?.url || '';
}

module.exports = { getLogo, getTvLogo };
