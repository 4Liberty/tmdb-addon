require('dotenv').config();
const { getTmdbClient } = require('../utils/getTmdbClient');
const Utils = require('../utils/parseProps');

const ageRatingCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getMovieAgeRating(tmdbId, language, config = {}) {
  try {
    const moviedb = getTmdbClient(config);
    const releaseDates = await moviedb.movieReleaseDates({ id: tmdbId });

    const userRegion = (language || 'en-US').split('-')[1] || 'US';

    let ageRating = Utils.parseCertification(releaseDates, language);
    if (!ageRating && userRegion !== 'US') {
      ageRating = Utils.parseCertification(releaseDates, 'en-US');
    }

    return ageRating || null;
  } catch (error) {
    console.error(`Error fetching age rating for movie ${tmdbId}:`, error?.message || error);
    return null;
  }
}

async function getTvAgeRating(tmdbId, language, config = {}) {
  try {
    const moviedb = getTmdbClient(config);
    const contentRatings = await moviedb.tvContentRatings({ id: tmdbId });

    const userRegion = (language || 'en-US').split('-')[1] || 'US';
    const results = contentRatings?.results || [];

    const userRegionRating = results.find((r) => r.iso_3166_1 === userRegion);
    if (userRegionRating?.rating) return userRegionRating.rating;

    const usRating = results.find((r) => r.iso_3166_1 === 'US');
    return usRating?.rating || null;
  } catch (error) {
    console.error(`Error fetching age rating for TV show ${tmdbId}:`, error?.message || error);
    return null;
  }
}

async function getCachedAgeRating(tmdbId, type, language, config = {}) {
  if (!tmdbId) return null;

  const key = `${type}-${tmdbId}-${language}`;
  const cached = ageRatingCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.rating;

  const rating = type === 'movie'
    ? await getMovieAgeRating(tmdbId, language, config)
    : await getTvAgeRating(tmdbId, language, config);

  ageRatingCache.set(key, { rating, timestamp: Date.now() });
  return rating;
}

module.exports = { getCachedAgeRating };
