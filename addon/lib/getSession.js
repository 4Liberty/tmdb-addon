require("dotenv").config();
const { get } = require("../utils/httpClient");

function requireTmdbApiKey() {
    const key = process.env.TMDB_API;
    if (!key) {
        throw new Error('TMDB_API not configured (needs the TMDB v3 API key).');
    }
    return key;
}

function resolveTmdbApiKey(overrideKey) {
    if (overrideKey && typeof overrideKey === 'string' && overrideKey.trim()) {
        return overrideKey.trim();
    }
    return requireTmdbApiKey();
}

async function getRequestToken(overrideKey) {
    const apiKey = resolveTmdbApiKey(overrideKey);
    try {
        const response = await get('https://api.themoviedb.org/3/authentication/token/new', {
            params: { api_key: apiKey }
        });
        if (response?.data?.success) return response.data.request_token;
        if (response?.data?.status_message) {
            throw new Error(String(response.data.status_message));
        }
        return response?.data?.request_token;
    } catch (error) {
        const statusMessage = error?.response?.data?.status_message;
        if (statusMessage) throw new Error(String(statusMessage));
        const status = error?.response?.status;
        if (status) throw new Error(`TMDB request failed with status ${status}`);
        throw error;
    }
}

async function getSessionId(requestToken, overrideKey) {
    if (!requestToken) throw new Error('Missing request token');
    const apiKey = resolveTmdbApiKey(overrideKey);
    try {
        const response = await get('https://api.themoviedb.org/3/authentication/session/new', {
            params: { api_key: apiKey, request_token: requestToken }
        });
        if (response?.data?.success) return response.data.session_id;
        if (response?.data?.status_message) {
            throw new Error(String(response.data.status_message));
        }
        return response?.data?.session_id;
    } catch (error) {
        const statusMessage = error?.response?.data?.status_message;
        if (statusMessage) throw new Error(String(statusMessage));
        const status = error?.response?.status;
        if (status) throw new Error(`TMDB request failed with status ${status}`);
        throw error;
    }
}

module.exports = { getRequestToken, getSessionId };