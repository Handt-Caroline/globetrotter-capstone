// db.js
// This is the ONLY file that reads/writes our JSON "database" (data/db.json).
// Centralizing this in one place prevents two requests from corrupting the
// file if they try to write at the same time.

const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

let writeQueue = Promise.resolve();

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  writeQueue = writeQueue.then(() => {
    return new Promise((resolve, reject) => {
      const tmpPath = DB_PATH + '.tmp';
      fs.writeFile(tmpPath, JSON.stringify(data, null, 2), (err) => {
        if (err) return reject(err);
        fs.rename(tmpPath, DB_PATH, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  });
  return writeQueue;
}

module.exports = { readDB, writeDB };