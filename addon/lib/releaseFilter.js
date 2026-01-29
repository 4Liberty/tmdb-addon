require('../utils/loadEnv')();
const { getTmdbClient } = require('../utils/getTmdbClient');
const { cache } = require('./getCache');

const RELEASE_KEY_PREFIX = 'tmdb-addon|release';
const RELEASE_TTL = 6 * 60 * 60; // seconds

async function getReleaseDates(movieId, config = {}) {
  const cacheKey = `${RELEASE_KEY_PREFIX}:${movieId}`;

  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      console.error(`Cache get error for ${cacheKey}:`, error?.message || error);
    }
  }

  try {
    const moviedb = getTmdbClient(config);
    const releaseDates = await moviedb.movieReleaseDates({ id: movieId });

    if (cache && releaseDates) {
      try {
        await cache.set(cacheKey, releaseDates, { ttl: RELEASE_TTL });
      } catch (error) {
        console.error(`Cache set error for ${cacheKey}:`, error?.message || error);
      }
    }

    return releaseDates;
  } catch (error) {
    console.error(`Error fetching release dates for movie ${movieId}:`, error?.message || error);
    return null;
  }
}

async function isMovieReleasedInRegion(movieId, region, config = {}) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const releaseDates = await getReleaseDates(movieId, config);

    if (!releaseDates?.results) return true;

    const regionRelease = releaseDates.results.find((r) => r.iso_3166_1 === region);
    if (!regionRelease?.release_dates) return false;

    const validReleaseTypes = [3, 4, 5, 6];

    return regionRelease.release_dates.some((rd) => {
      const releaseDate = rd?.release_date?.split('T')?.[0];
      if (!releaseDate) return false;
      return releaseDate <= today && validReleaseTypes.includes(rd.type);
    });
  } catch (error) {
    console.error(`Error checking release dates for movie ${movieId}:`, error?.message || error);
    return true;
  }
}

async function isMovieReleasedDigitally(movieId, config = {}) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const releaseDates = await getReleaseDates(movieId, config);

    if (!releaseDates?.results) return true;

    const digitalReleaseTypes = [4, 5, 6];

    for (const regionData of releaseDates.results) {
      if (!regionData?.release_dates) continue;

      const hasDigitalRelease = regionData.release_dates.some((rd) => {
        const releaseDate = rd?.release_date?.split('T')?.[0];
        if (!releaseDate) return false;
        return releaseDate <= today && digitalReleaseTypes.includes(rd.type);
      });

      if (hasDigitalRelease) return true;
    }

    return false;
  } catch (error) {
    console.error(`Error checking digital release for movie ${movieId}:`, error?.message || error);
    return true;
  }
}

module.exports = { isMovieReleasedInRegion, isMovieReleasedDigitally };
