require("dotenv").config();
const { MovieDb } = require("moviedb-promise");
const moviedb = new MovieDb(process.env.TMDB_API);
const { getGenreList } = require("./getGenreList");
const { getLanguages } = require("./getLanguages");
const { parseMedia } = require("../utils/parseProps");
const { fetchMDBListItems, parseMDBListItems } = require("../utils/mdbList");
const CATALOG_TYPES = require("../static/catalog-types.json");

const { toCanonicalType } = require("../utils/typeCanonical");

async function getCatalog(type, language, page, id, genre, config) {
  type = toCanonicalType(type);
  const mdblistKey = config.mdblistkey;

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

  const genreList = await getGenreList(language, type);
  const parameters = await buildParameters(
    type,
    language,
    page,
    id,
    genre,
    genreList,
    config
  );

  const fetchFunction =
    type === "movie"
      ? moviedb.discoverMovie.bind(moviedb)
      : moviedb.discoverTv.bind(moviedb);

  return fetchFunction(parameters)
    .then((res) => {
      // TMDB API returns items with implicit type based on endpoint:
      // discoverMovie returns movie items, discoverTv returns tv items
      const tmdbType = type === "movie" ? "movie" : "tv";
      const metas = res.results.map(item => parseMedia(item, tmdbType, genreList));
      return { metas };
    })
    .catch(error => {
      console.error("Error in getCatalog:", error);
      throw error;
    });
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
  const languages = await getLanguages();
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

  if (id.includes("streaming")) {
    const provider = findProvider(id.split(".")[1]);

    parameters.with_genres = genre ? findGenreId(genre, genreList) : undefined;
    parameters.with_watch_providers = provider.watchProviderId;
    parameters.watch_region = provider.country;
    parameters.with_watch_monetization_types = "flatrate|free|ads";
  } else {
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
