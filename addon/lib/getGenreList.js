require('dotenv').config()
const { getTmdbClient } = require('../utils/getTmdbClient')

const fallbackMovieGenres = require('../static/fallback-genres-movie.json');
const fallbackSeriesGenres = require('../static/fallback-genres-series.json');

async function getGenreList(language, type, config = {}) {
  const moviedb = getTmdbClient(config);

  try {
    if (type === "movie") {
      const res = await moviedb.genreMovieList({ language });
      return res?.genres || fallbackMovieGenres;
    }

    const res = await moviedb.genreTvList({ language });
    return res?.genres || fallbackSeriesGenres;
  } catch (error) {
    console.error('Error in getGenreList:', error?.message || error);
    return type === 'movie' ? fallbackMovieGenres : fallbackSeriesGenres;
  }
}

module.exports = { getGenreList };
