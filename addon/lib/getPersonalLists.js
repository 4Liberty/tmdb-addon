require("dotenv").config();
const { getTmdbClient } = require("../utils/getTmdbClient");
const { getGenreList } = require("./getGenreList");
const { parseMedia } = require("../utils/parseProps");
const { toCanonicalType } = require("../utils/typeCanonical");
const translations = require("../static/translations.json");

const STREMIO_PAGE_SIZE = 100;
const TMDB_PAGE_SIZE = 20;
const TMDB_PAGES_PER_STREMIO_PAGE = Math.ceil(STREMIO_PAGE_SIZE / TMDB_PAGE_SIZE);

function getAllTranslations(key) {
    return Object.values(translations).map(lang => lang[key]).filter(Boolean);
}

const API_FIELD_MAPPING = {
    'added_date': 'created_at',
    'popularity': 'popularity',
    'release_date': 'release_date'
};

function sortResults(results, genre) {
    if (!genre) return results;

    let sortedResults = [...results];

    const randomTranslations = getAllTranslations('random');
    if (randomTranslations.includes(genre)) {
        return shuffleArray(sortedResults);
    }

    let field, order;

    const fields = {
        'added_date': getAllTranslations('added_date'),
        'popularity': getAllTranslations('popularity'),
        'release_date': getAllTranslations('release_date')
    };

    for (const [fieldName, translations] of Object.entries(fields)) {
        if (translations.some(t => genre.includes(t))) {
            field = fieldName;
            break;
        }
    }

    if (!field) return sortedResults;

    const ascTranslations = getAllTranslations('asc');
    const descTranslations = getAllTranslations('desc');

    if (ascTranslations.some(t => genre.includes(t))) {
        order = 'asc';
    } else if (descTranslations.some(t => genre.includes(t))) {
        order = 'desc';
    } else {
        return sortedResults;
    }

    sortedResults.sort((a, b) => {
        let valueA, valueB;

        switch (field) {
            case 'release_date':
                valueA = a.release_date || a.first_air_date;
                valueB = b.release_date || b.first_air_date;
                break;
            case 'popularity':
                valueA = a.popularity;
                valueB = b.popularity;
                break;
            case 'added_date':
            default:
                return 0;
        }

        if (order === 'asc') {
            return valueA < valueB ? -1 : 1;
        }
        return valueA > valueB ? -1 : 1;
    });

    return sortedResults;
}

function configureSortingParameters(parameters, genre) {
    const fields = {
        'added_date': getAllTranslations('added_date'),
        'popularity': getAllTranslations('popularity'),
        'release_date': getAllTranslations('release_date')
    };

    for (const [fieldName, translations] of Object.entries(fields)) {
        if (translations.some(t => genre?.includes(t))) {
            const ascTranslations = getAllTranslations('asc');
            const descTranslations = getAllTranslations('desc');

            if (ascTranslations.some(t => genre.includes(t))) {
                parameters.sort_by = `${API_FIELD_MAPPING[fieldName]}.asc`;
            } else if (descTranslations.some(t => genre.includes(t))) {
                parameters.sort_by = `${API_FIELD_MAPPING[fieldName]}.desc`;
            }
            break;
        }
    }
    return parameters;
}

async function getFavorites(type, language, page, genre, sessionId) {
    const canonicalType = toCanonicalType(type);
    const moviedb = getTmdbClient({ noCacheClient: true });
    moviedb.sessionId = sessionId;
    const stremioPage = Number(page) > 0 ? Number(page) : 1;
    let parameters = { language };
    parameters = configureSortingParameters(parameters, genre);

    const genreList = await getGenreList(language, canonicalType);
    const fetchFunction = canonicalType === "movie" ? moviedb.accountFavoriteMovies.bind(moviedb) : moviedb.accountFavoriteTv.bind(moviedb);

    try {
        const tmdbType = canonicalType === "movie" ? "movie" : "tv";
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

        const sorted = sortResults(results, genre);
        return {
            metas: sorted.slice(0, STREMIO_PAGE_SIZE).map((el) => parseMedia(el, tmdbType, genreList))
        };
    } catch (err) {
        console.error(err);
        throw err;
    }
}

async function getWatchList(type, language, page, genre, sessionId) {
    const canonicalType = toCanonicalType(type);
    const moviedb = getTmdbClient({ noCacheClient: true });
    moviedb.sessionId = sessionId;
    const stremioPage = Number(page) > 0 ? Number(page) : 1;
    let parameters = { language };
    parameters = configureSortingParameters(parameters, genre);

    const genreList = await getGenreList(language, canonicalType);
    const fetchFunction = canonicalType === "movie" ? moviedb.accountMovieWatchlist.bind(moviedb) : moviedb.accountTvWatchlist.bind(moviedb);

    try {
        const tmdbType = canonicalType === "movie" ? "movie" : "tv";
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

        const sorted = sortResults(results, genre);
        return {
            metas: sorted.slice(0, STREMIO_PAGE_SIZE).map((el) => parseMedia(el, tmdbType, genreList))
        };
    } catch (err) {
        console.error(err);
        throw err;
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

module.exports = { getFavorites, getWatchList };