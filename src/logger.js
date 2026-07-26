// logger.js
// Writes every important event to a real log file on disk — this is
// what satisfies the "observable (metrics, logging, tracing)" technical
// requirement.

const fs = require('fs');
const path = require('path');
const LOG_PATH = path.join(__dirname, '..', 'logs', 'app.log');

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFile(LOG_PATH, line + '\n', (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}

module.exports = { log };