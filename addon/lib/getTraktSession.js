require('dotenv').config();
const { post } = require('../utils/httpClient');

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;

function getRedirectUri(requestHost = null) {
  if (requestHost) {
    const baseUrl = requestHost.replace(/\/$/, '');
    return `${baseUrl}/configure/oauth-callback`;
  }

  const baseUrl = process.env.HOST_NAME || 'http://localhost:3000';
  return process.env.TRAKT_REDIRECT_URI || `${baseUrl}/configure/oauth-callback`;
}

async function getTraktAuthUrl(requestHost = null) {
  if (!TRAKT_CLIENT_ID) throw new Error('TRAKT_CLIENT_ID not configured');

  const redirectUri = getRedirectUri(requestHost);
  const state =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const authUrl =
    `https://trakt.tv/oauth/authorize?response_type=code&client_id=${TRAKT_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return { authUrl, state, redirectUri };
}

async function getTraktAccessToken(code, redirectUri = null) {
  if (!TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET) {
    throw new Error('TRAKT_CLIENT_ID or TRAKT_CLIENT_SECRET not configured');
  }

  const finalRedirectUri = redirectUri || getRedirectUri();

  const response = await post(
    'https://api.trakt.tv/oauth/token',
    {
      code,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
      redirect_uri: finalRedirectUri,
      grant_type: 'authorization_code',
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  return response?.data || response;
}

async function refreshTraktAccessToken(refreshToken, redirectUri = null) {
  if (!TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET) {
    throw new Error('TRAKT_CLIENT_ID or TRAKT_CLIENT_SECRET not configured');
  }

  const finalRedirectUri = redirectUri || getRedirectUri();

  const response = await post(
    'https://api.trakt.tv/oauth/token',
    {
      refresh_token: refreshToken,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
      redirect_uri: finalRedirectUri,
      grant_type: 'refresh_token',
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  return response?.data || response;
}

module.exports = { getTraktAuthUrl, getTraktAccessToken, refreshTraktAccessToken };
