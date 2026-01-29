require('../utils/loadEnv')();
const { getTmdbClient } = require("../utils/getTmdbClient");
const { getGenreList } = require("./getGenreList");
const { getLanguages } = require("./getLanguages");
const { parseMedia } = require("../utils/parseProps");
const { fetchMDBListItems, parseMDBListItems } = require("../utils/mdbList");
const CATALOG_TYPES = require("../static/catalog-types.json");

const { toCanonicalType } = require("../utils/typeCanonical");

const STREMIO_PAGE_SIZE = 100;
const TMDB_PAGE_SIZE = 20;
const TMDB_PAGES_PER_STREMIO_PAGE = Math.ceil(STREMIO_PAGE_SIZE / TMDB_PAGE_SIZE);

async function getCatalog(type, language, page, id, genre, config) {
  type = toCanonicalType(type);
  const moviedb = getTmdbClient(config);
  const mdblistKey = config.mdblistkey;

  const stremioPage = Number(page) > 0 ? Number(page) : 1;

  if (id.startsWith("mdblist.")) {
    const listId = id.split(".")[1];
    let filteredMetas = [];
    let currentPage = 1;
    const pageSize = 100; // Standard Stremio page size
    const needed = page * pageSize;

    while (filteredMetas.length < needed) {
      const items = await fetchMDBListItems(
        listId,
        mdblistKey,
        language,
        currentPage
      );
      if (items.length === 0) {
        break; 
      }

      const parsed = await parseMDBListItems(
        items,
        type,
        genre,
        language,
        config.rpdbkey
      );
      filteredMetas.push(...parsed.metas);
      currentPage++;
    }

    const startIndex = (page - 1) * pageSize;
    const metas = filteredMetas.slice(startIndex, startIndex + pageSize);

    return { metas };
  }

  const genreList = await getGenreList(language, type, config);
  const parameters = await buildParameters(
    type,
    language,
    stremioPage,
    id,
    genre,
    genreList,
    config
  );

  const fetchFunction =
    type === "movie"
      ? moviedb.discoverMovie.bind(moviedb)
      : moviedb.discoverTv.bind(moviedb);

  try {
    // TMDB discover endpoints return 20 items per page. Stremio expects 100 per "page".
    const tmdbType = type === "movie" ? "movie" : "tv";
    const startTmdbPage = (stremioPage - 1) * TMDB_PAGES_PER_STREMIO_PAGE + 1;
    const endTmdbPage = startTmdbPage + TMDB_PAGES_PER_STREMIO_PAGE - 1;

    const results = [];
    let totalPages = Infinity;

    for (let tmdbPage = startTmdbPage; tmdbPage <= endTmdbPage && tmdbPage <= totalPages; tmdbPage++) {
      const res = await fetchFunction({ ...parameters, page: tmdbPage });
      if (Number.isFinite(res?.total_pages)) totalPages = res.total_pages;

      const pageResults = Array.isArray(res?.results) ? res.results : [];
      if (pageResults.length === 0) break;
      results.push(...pageResults);
    }

    const metas = results
      .slice(0, STREMIO_PAGE_SIZE)
      .map((item) => parseMedia(item, tmdbType, genreList));

    return { metas };
  } catch (error) {
    console.error("Error in getCatalog:", error);
    throw error;
  }
}

async function buildParameters(
  type,
  language,
  page,
  id,
  genre,
  genreList,
  config
) {
  const languages = await getLanguages(config);
  const parameters = { language, page, "vote_count.gte": 10 };

  if (config.ageRating) {
    switch (config.ageRating) {
      case "G":
        parameters.certification_country = "US";
        parameters.certification = type === "movie" ? "G" : "TV-G";
        break;
      case "PG":
        parameters.certification_country = "US";
        parameters.certification =
          type === "movie" ? ["G", "PG"].join("|") : ["TV-G", "TV-PG"].join("|");
        break;
      case "PG-13":
        parameters.certification_country = "US";
        parameters.certification =
          type === "movie"
            ? ["G", "PG", "PG-13"].join("|")
            : ["TV-G", "TV-PG", "TV-14"].join("|");
        break;
      case "R":
        parameters.certification_country = "US";
        parameters.certification =
          type === "movie"
            ? ["G", "PG", "PG-13", "R"].join("|")
            : ["TV-G", "TV-PG", "TV-14", "TV-MA"].join("|");
        break;
      case "NC-17":
        break;
    }
  }

  const providerId = id.split(".")[1];
  const isStreaming = Object.keys(CATALOG_TYPES.streaming).includes(providerId);

  if (isStreaming) {
    const provider = findProvider(providerId);

    parameters.with_genres = genre ? findGenreId(genre, genreList) : undefined;
    parameters.with_watch_providers = provider.watchProviderId;
    parameters.watch_region = provider.country;
    parameters.with_watch_monetization_types = "flatrate|free|ads";
  } else {
    // Apply region filtering for "Top" and "Year" catalogs
    // This prioritizes content released in the selected region (e.g., Italy)
    // ONLY if strict region filtering is enabled
    if ((config.strictRegionFilter === "true" || config.strictRegionFilter === true) && (id === "tmdb.top" || id === "tmdb.year") && language && language.split('-')[1]) {
      parameters.region = language.split('-')[1];
      const today = new Date().toISOString().split('T')[0];
      if (type === "movie") {
        parameters['release_date.lte'] = today;
        parameters.with_release_type = "4|5|6";
      } else {
        parameters['first_air_date.lte'] = today;
      }
    }

    switch (id) {
      case "tmdb.top":
        parameters.with_genres = genre ? findGenreId(genre, genreList) : undefined;
        if (type === "series") {
          parameters.watch_region = language.split("-")[1];
          parameters.with_watch_monetization_types = "flatrate|free|ads|rent|buy";
        }
        break;
      case "tmdb.year":
        const year = genre ? genre : new Date().getFullYear();
        parameters[
          type === "movie" ? "primary_release_year" : "first_air_date_year"
        ] = year;
        break;
      case "tmdb.language":
        const findGenre = genre
          ? findLanguageCode(genre, languages)
          : language.split("-")[0];
        parameters.with_original_language = findGenre;
        break;
      case "tmdb.latest":
        parameters.with_genres = genre ? findGenreId(genre, genreList) : undefined;
        const date = new Date();
        const today = date.toISOString().split('T')[0];

        // Go back 1 month
        date.setMonth(date.getMonth() - 1);
        const oneMonthAgo = date.toISOString().split('T')[0];

        if (type === "movie") {
          parameters["primary_release_date.gte"] = oneMonthAgo;
          parameters["primary_release_date.lte"] = today;
          parameters["sort_by"] = "primary_release_date.desc";
        } else {
          parameters["first_air_date.gte"] = oneMonthAgo;
          parameters["first_air_date.lte"] = today;
          parameters["sort_by"] = "first_air_date.desc";
        }
        break;
      default:
        break;
    }
  }
  return parameters;
}

function findGenreId(genreName, genreList) {
  const genreData = genreList.find((genre) => genre.name === genreName);
  return genreData ? genreData.id : undefined;
}

function findLanguageCode(genre, languages) {
  const language = languages.find((lang) => lang.name === genre);
  return language ? language.iso_639_1.split("-")[0] : "";
}

function findProvider(providerId) {
  const provider = CATALOG_TYPES.streaming[providerId];
  if (!provider) throw new Error(`Could not find provider: ${providerId}`);
  return provider;
}

module.exports = { getCatalog };
