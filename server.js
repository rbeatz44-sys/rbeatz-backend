require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { pool, initSchema } = require('./db');
const { uploadFile, deleteFile } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple password gate for creator-only actions (upload/delete)
const CREATOR_EMAIL = process.env.CREATOR_EMAIL || 'rbeatz44@gmail.com';
const CREATOR_PASSWORD = process.env.CREATOR_PASSWORD || 'rele@2008';

app.use(cors());
app.use(express.json());
// Prevent browsers from caching the site's HTML/JS/CSS so updates always show immediately
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Multer — handles multipart file uploads, keeps files in memory briefly before pushing to R2
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

function requireCreator(req, res, next) {
  const { email, password } = req.body;
  if (email === CREATOR_EMAIL && password === CREATOR_PASSWORD) return next();
  // Also allow via header for delete requests (no body)
  const headerAuth = req.headers['x-creator-auth'];
  if (headerAuth === `${CREATOR_EMAIL}:${CREATOR_PASSWORD}`) return next();
  return res.status(401).json({ error: 'Invalid creator credentials' });
}

// ─── Login check ────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email === CREATOR_EMAIL && password === CREATOR_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// ─── Tracks ──────────────────────────────────────────────────────────────────
app.get('/api/tracks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tracks ORDER BY created_at ASC');
    res.json(rows.map(serializeTrack));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tracks' });
  }
});

app.post('/api/tracks/upload', upload.single('audio'), async (req, res) => {
  try {
    const { email, password, title, genre, bpm, albumId, trackNumber } = req.body;
    if (email !== CREATOR_EMAIL || password !== CREATOR_PASSWORD) {
      return res.status(401).json({ error: 'Invalid creator credentials' });
    }
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
    if (!title || !genre) return res.status(400).json({ error: 'Title and genre are required' });

    const { key, url } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    const { rows } = await pool.query(
      `INSERT INTO tracks (title, genre, bpm, file_url, file_key, file_name, file_size, album_id, track_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, genre, bpm ? parseInt(bpm) : null, url, key, req.file.originalname, req.file.size,
       albumId ? parseInt(albumId) : null, trackNumber ? parseInt(trackNumber) : null]
    );
    res.status(201).json(serializeTrack(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Upload failed', details: err.message });
  }
});

app.delete('/api/tracks/:id', async (req, res) => {
  try {
    const auth = req.headers['x-creator-auth'];
    if (auth !== `${CREATOR_EMAIL}:${CREATOR_PASSWORD}`) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query('SELECT file_key FROM tracks WHERE id=$1', [req.params.id]);
    if (rows[0]) await deleteFile(rows[0].file_key);
    await pool.query('DELETE FROM tracks WHERE id=$1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ─── Albums ──────────────────────────────────────────────────────────────────
app.get('/api/albums', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM albums ORDER BY created_at ASC');
    res.json(rows.map(serializeAlbum));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load albums' });
  }
});

app.post('/api/albums', upload.single('cover'), async (req, res) => {
  try {
    const { email, password, title, description, releaseYear } = req.body;
    if (email !== CREATOR_EMAIL || password !== CREATOR_PASSWORD) {
      return res.status(401).json({ error: 'Invalid creator credentials' });
    }
    if (!title) return res.status(400).json({ error: 'Album title is required' });

    let coverUrl = null, coverKey = null;
    if (req.file) {
      const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      coverUrl = result.url; coverKey = result.key;
    }

    const { rows } = await pool.query(
      `INSERT INTO albums (title, description, cover_url, cover_key, release_year)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, description || '', coverUrl, coverKey, releaseYear ? parseInt(releaseYear) : null]
    );
    res.status(201).json(serializeAlbum(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Album creation failed', details: err.message });
  }
});

app.delete('/api/albums/:id', async (req, res) => {
  try {
    const auth = req.headers['x-creator-auth'];
    if (auth !== `${CREATOR_EMAIL}:${CREATOR_PASSWORD}`) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: trackRows } = await pool.query('SELECT file_key FROM tracks WHERE album_id=$1', [req.params.id]);
    for (const t of trackRows) await deleteFile(t.file_key);

    const { rows: albumRows } = await pool.query('SELECT cover_key FROM albums WHERE id=$1', [req.params.id]);
    if (albumRows[0]?.cover_key) await deleteFile(albumRows[0].cover_key);

    await pool.query('DELETE FROM tracks WHERE album_id=$1', [req.params.id]);
    await pool.query('DELETE FROM albums WHERE id=$1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function serializeTrack(t) {
  return {
    id: t.id, title: t.title, genre: t.genre, bpm: t.bpm,
    objectPath: t.file_url, fileName: t.file_name, fileSize: t.file_size,
    duration: t.duration, albumId: t.album_id, trackNumber: t.track_number,
    createdAt: t.created_at,
  };
}
function serializeAlbum(a) {
  return {
    id: a.id, title: a.title, description: a.description,
    coverObjectPath: a.cover_url, releaseYear: a.release_year, createdAt: a.created_at,
  };
}

// Fallback to index.html for any unmatched route (single-page app style)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`✓ RP-Rbeatz44 server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
