require("dotenv").config();
const { get } = require("../utils/httpClient");

function requireTmdbApiKey() {
    const key = process.env.TMDB_API;
    if (!key) {
        throw new Error('TMDB_API not configured (needs the TMDB v3 API key).');
    }
    return key;
}

async function getRequestToken() {
    const apiKey = requireTmdbApiKey();
    const response = await get('https://api.themoviedb.org/3/authentication/token/new', {
        params: { api_key: apiKey }
    });
    if (response?.data?.success) return response.data.request_token;
    return response?.data?.request_token;
}

async function getSessionId(requestToken) {
    if (!requestToken) throw new Error('Missing request token');
    const apiKey = requireTmdbApiKey();
    const response = await get('https://api.themoviedb.org/3/authentication/session/new', {
        params: { api_key: apiKey, request_token: requestToken }
    });
    if (response?.data?.success) return response.data.session_id;
    return response?.data?.session_id;
}

module.exports = { getRequestToken, getSessionId }