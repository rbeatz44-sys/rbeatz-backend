const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Get one free from neon.tech');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Neon
});

// Create tables if they don't exist yet — runs once on server startup
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS albums (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_url TEXT,
      cover_key TEXT,
      release_year INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      genre TEXT NOT NULL,
      bpm INTEGER,
      file_url TEXT NOT NULL,
      file_key TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      duration TEXT,
      album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
      track_number INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('✓ Database schema ready');
}

module.exports = { pool, initSchema };
