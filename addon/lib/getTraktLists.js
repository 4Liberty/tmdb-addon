require('dotenv').config();
const { get } = require('../utils/httpClient');
const { getMeta } = require('./getMeta');

async function getTraktWatchlist(type, language, page, genre, accessToken, config = {}) {
  if (!accessToken) throw new Error('Trakt access token not provided');

  const typeParam = type === 'movie' ? 'movies' : 'shows';
  const limit = 20;
  const offset = (page - 1) * limit;

  const response = await get(
    `https://api.trakt.tv/sync/watchlist/${typeParam}?limit=${limit}&page=${page}&extended=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'trakt-api-version': '2',
        'trakt-api-key': process.env.TRAKT_CLIENT_ID,
      },
    }
  );

  const items = response?.data || [];
  const metas = [];

  for (const item of items) {
    try {
      const tmdbId = type === 'movie' ? item?.movie?.ids?.tmdb : item?.show?.ids?.tmdb;
      if (!tmdbId) continue;
      const meta = await getMeta(type, language, tmdbId, config);
      if (meta?.meta) metas.push(meta.meta);
    } catch (err) {
      console.error('Error processing Trakt item:', err?.message || err);
    }
  }

  return { metas };
}

async function getTraktRecommendations(type, language, page, genre, accessToken, config = {}) {
  if (!accessToken) throw new Error('Trakt access token not provided');

  const typeParam = type === 'movie' ? 'movies' : 'shows';
  const limit = 20;

  const response = await get(
    `https://api.trakt.tv/recommendations/${typeParam}?limit=${limit}&page=${page}&extended=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'trakt-api-version': '2',
        'trakt-api-key': process.env.TRAKT_CLIENT_ID,
      },
    }
  );

  const items = response?.data || [];
  const metas = [];

  for (const item of items) {
    try {
      const tmdbId = item?.ids?.tmdb;
      if (!tmdbId) continue;
      const meta = await getMeta(type, language, tmdbId, config);
      if (meta?.meta) metas.push(meta.meta);
    } catch (err) {
      console.error('Error processing Trakt recommendation:', err?.message || err);
    }
  }

  return { metas };
}

module.exports = { getTraktWatchlist, getTraktRecommendations };
