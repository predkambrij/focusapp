const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Hardcoded password - change this to your own
const PASSWORD = 'focus123';

// Path to the notes file
const NOTES_FILE = path.join(__dirname, 'notes.md');

app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));

// Auth middleware
const checkAuth = (req, res, next) => {
  const pwd = req.cookies?.auth;
  if (pwd !== PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Check if authenticated
app.get('/api/check-auth', (req, res) => {
  const pwd = req.cookies?.auth;
  if (pwd === PASSWORD) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Get notes content
app.get('/api/content', checkAuth, (req, res) => {
  try {
    if (!fs.existsSync(NOTES_FILE)) {
      fs.writeFileSync(NOTES_FILE, '# My Notes\n\nStart writing here...\n');
    }
    const content = fs.readFileSync(NOTES_FILE, 'utf-8');
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read notes file' });
  }
});

// SSE endpoint for live updates
app.get('/api/content-updates', checkAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial content
  try {
    const content = fs.readFileSync(NOTES_FILE, 'utf-8');
    res.write(`data: ${JSON.stringify({ content })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Failed to read file' })}\n\n`);
  }

  // Watch for file changes
  let watcher;
  let debounceTimer;
  
  try {
    watcher = fs.watch(NOTES_FILE, (eventType) => {
      if (eventType === 'change') {
        // Debounce to avoid multiple rapid updates
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          try {
            const content = fs.readFileSync(NOTES_FILE, 'utf-8');
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          } catch (err) {
            // File might be temporarily unavailable
          }
        }, 100);
      }
    });
  } catch (err) {
    console.error('Failed to watch file:', err);
  }

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(heartbeat);
    clearTimeout(debounceTimer);
    if (watcher) watcher.close();
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Focus App Assistant running at http://localhost:${PORT}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Notes file: ${NOTES_FILE}`);
});
