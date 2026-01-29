let loaded = false;

module.exports = function loadEnv() {
  if (loaded) return;
  loaded = true;

  // In containers and platforms like Coolify, environment variables are typically
  // injected by the orchestrator, so dotenv is optional.
  if (process.env.DOTENV_DISABLE === '1') return;

  try {
    // Optional dependency: do not crash if it's not installed.
    // eslint-disable-next-line global-require
    const dotenv = require('dotenv');
    dotenv.config();
  } catch (error) {
    if (process.env.DOTENV_DEBUG === '1') {
      const message = error?.message ? String(error.message) : String(error);
      // eslint-disable-next-line no-console
      console.warn('[dotenv] skipped:', message);
    }
  }
};
