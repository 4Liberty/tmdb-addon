require('../utils/loadEnv')();
const { getTmdbClient } = require("../utils/getTmdbClient");

const fallbackLanguages = require("../static/fallback-languages.json");

async function getLanguages(config = {}) {
  try {
    const moviedb = getTmdbClient(config);
    const [primaryTranslations, languages] = await Promise.all([
      moviedb.primaryTranslations(),
      moviedb.languages(),
    ]);

    return (primaryTranslations || []).map((element) => {
      const [language] = String(element).split("-");
      const findLanguage = (languages || []).find((obj) => obj.iso_639_1 === language);
      return { iso_639_1: element, name: findLanguage?.english_name || findLanguage?.name || language };
    });
  } catch (error) {
    console.error('Error in getLanguages:', error?.message || error);
    return fallbackLanguages;
  }
}

module.exports = { getLanguages };
