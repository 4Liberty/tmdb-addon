const { MovieDb } = require('moviedb-promise');
const { createAxiosInstance } = require('./httpClient');

class TMDBClient extends MovieDb {
  constructor(apiKey) {
    super(apiKey);

    this._request = async (url, options = {}) => {
      const instance = createAxiosInstance(url);

      try {
        const response = await instance.request({
          url,
          method: options.method || 'GET',
          data: options.data,
          params: options.params,
          headers: options.headers,
          ...options,
        });
        return response.data;
      } catch (error) {
        if (error?.response?.status === 401) {
          const apiError = new Error('TMDB_API_KEY_INVALID');
          apiError.statusCode = 401;
          apiError.userMessage =
            error.response?.data?.status_message || 'TMDB API Key is invalid or expired.';
          apiError.originalError = error;
          throw apiError;
        }
        throw error;
      }
    };
  }

  async request(url, options = {}) {
    return this._request(url, options);
  }
}

module.exports = { TMDBClient };
