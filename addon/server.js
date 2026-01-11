require('dotenv').config();

const addon = require('./index.js')
const PORT = process.env.PORT || 1337;

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

addon.listen(PORT, function () {
  console.log(`Addon active on port ${PORT}.`);
  console.log(`http://127.0.0.1:${PORT}/`);
});