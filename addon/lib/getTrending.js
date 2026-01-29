require('../utils/loadEnv')();
const { getTmdbClient } = require("../utils/getTmdbClient");
const { parseMedia } = require("../utils/parseProps");
const { getGenreList } = require("./getGenreList");
const { toCanonicalType } = require("../utils/typeCanonical");

const STREMIO_PAGE_SIZE = 100;
const TMDB_PAGE_SIZE = 20;
const TMDB_PAGES_PER_STREMIO_PAGE = Math.ceil(STREMIO_PAGE_SIZE / TMDB_PAGE_SIZE);
const MAX_TMDB_PAGES_PER_REQUEST = 10;

async function getTrending(type, language, page, genre, config) {
  const canonicalType = toCanonicalType(type);
  const moviedb = getTmdbClient(config);
  const media_type = canonicalType === "series" ? "tv" : "movie";
  const stremioPage = Number(page) > 0 ? Number(page) : 1;
  const parameters = {
    media_type,
    time_window: "day", // Fixed: time_window should always be day/week/month, NOT genre
    language,
  };

  const genreList = await getGenreList(language, canonicalType, config);

  try {
    const startTmdbPage = (stremioPage - 1) * TMDB_PAGES_PER_STREMIO_PAGE + 1;
    let tmdbPage = startTmdbPage;
    let fetchedPages = 0;
    let totalPages = Infinity;
    const results = [];

    const targetGenreId =
      genre && genreList.length > 0 ? genreList.find((g) => g.name === genre)?.id : undefined;

    while (
      results.length < STREMIO_PAGE_SIZE &&
      tmdbPage <= totalPages &&
      fetchedPages < MAX_TMDB_PAGES_PER_REQUEST
    ) {
      const res = await moviedb.trending({ ...parameters, page: tmdbPage });
      if (Number.isFinite(res?.total_pages)) totalPages = res.total_pages;
      const pageResults = Array.isArray(res?.results) ? res.results : [];
      if (pageResults.length === 0) break;

      if (targetGenreId) {
        results.push(
          ...pageResults.filter(
            (item) => Array.isArray(item.genre_ids) && item.genre_ids.includes(targetGenreId)
          )
        );
      } else {
        results.push(...pageResults);
      }

      tmdbPage++;
      fetchedPages++;
    }

    const metas = results
      .slice(0, STREMIO_PAGE_SIZE)
      .map((item) => {
        const itemType = item.media_type || media_type;
        return parseMedia(item, itemType, genreList);
      });

    return { metas };
  } catch (error) {
    console.error("Error in getTrending:", error);
    throw error;
  }
}

module.exports = { getTrending };
