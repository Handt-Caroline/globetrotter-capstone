// logger.js
// Writes every important event to a real log file on disk — this is
// what satisfies the "observable (metrics, logging, tracing)" technical
// requirement.

const fs = require('fs');
const path = require('path');
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_PATH = path.join(LOG_DIR, 'app.log');

// Ensure the logs directory exists — it isn't committed to git (log files
// are gitignored), so on a fresh clone/container it may not exist yet.
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFile(LOG_PATH, line + '\n', (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}

module.exports = { log };