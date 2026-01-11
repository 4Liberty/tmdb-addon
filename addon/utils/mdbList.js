// addon/utils/mdbList.js

const axios = require("axios");
const { getMeta } = require("../lib/getMeta");
const { getGenreList } = require("../lib/getGenreList");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapInBatches(items, mapper, { batchSize = 5, delayMs = 0 } = {}) {
  const results = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(mapper));
    results.push(...batchResults);

    const hasMore = index + batchSize < items.length;
    if (hasMore && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return results;
}

async function fetchMDBListItems(listId, apiKey, language, page) {
    const offset = (page * 100) - 100;
  try {
    const url = `https://api.mdblist.com/lists/${listId}/items?language=${language}&limit=100&offset=${offset}&apikey=${apiKey}&append_to_response=genre,poster`;
    const response = await axios.get(url);
    return [
      ...(response.data.movies || []),
      ...(response.data.shows || [])
    ];
  } catch (err) {
    console.error("Error retrieving MDBList items:", err.message, err);
    return [];
  }
}

async function getGenresFromMDBList(listId, apiKey) {
  try {
    const items = await fetchMDBListItems(listId, apiKey);
    const genres = [
      ...new Set(
        items.flatMap(item =>
          (item.genre || []).map(g => {
            if (!g || typeof g !== "string") return null;
            return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
          })
        ).filter(Boolean)
      )
    ].sort();
    return genres;
  } catch (err) {
    console.error("ERROR in getGenresFromMDBList:", err);
    return [];
  }
}

async function parseMDBListItems(items, type, genreFilter, language, config = {}) {
  const { rpdbkey } = config;

  const availableGenres = [
    ...new Set(
      items.flatMap(item =>
        (item.genre || [])
          .map(g =>
            typeof g === "string"
              ? g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()
              : null
          )
          .filter(Boolean)
      )
    )
  ].sort();

  let filteredItems = items;
  if (genreFilter) {
    filteredItems = filteredItems.filter(item =>
      Array.isArray(item.genre) &&
      item.genre.some(
        g =>
          typeof g === "string" &&
          g.toLowerCase() === genreFilter.toLowerCase()
      )
    );
  }

  const filteredItemsByType = filteredItems
    .filter(item => {
      if (type === "series") return item.mediatype === "show";
      if (type === "movie") return item.mediatype === "movie";
      return false;
    })
    .map(item => ({
      id: item.id,
      type: type
    }));

  const metas = (
    await mapInBatches(
      filteredItemsByType,
      (item) =>
        getMeta(item.type, language, item.id, rpdbkey)
          .then((result) => result.meta)
          .catch((err) => {
            console.error(
              `Erro ao buscar metadados para ${item.id} from MDBList:`,
              err.message
            );
            return null;
          }),
      { batchSize: 5, delayMs: 200 }
    )
  ).filter(Boolean);

  return { metas, availableGenres };
}

module.exports = { fetchMDBListItems, getGenresFromMDBList, parseMDBListItems };
