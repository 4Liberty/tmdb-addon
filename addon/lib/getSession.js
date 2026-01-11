require("dotenv").config();
const { get } = require("../utils/httpClient");

async function getRequestToken() {
    const response = await get('https://api.themoviedb.org/3/authentication/token/new', {
        params: { api_key: process.env.TMDB_API }
    });
    if (response?.data?.success) return response.data.request_token;
    return response?.data?.request_token;
}

async function getSessionId(requestToken) {
    const response = await get('https://api.themoviedb.org/3/authentication/session/new', {
        params: { api_key: process.env.TMDB_API, request_token: requestToken }
    });
    if (response?.data?.success) return response.data.session_id;
    return response?.data?.session_id;
}

module.exports = { getRequestToken, getSessionId }