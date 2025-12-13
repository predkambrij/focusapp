const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Use environment variables instead of config file for Vercel
const HOST = 'localhost';
const PORT = 3000;
const PASSWORD = 'demo123';
const GROK_PROMPT_TEMPLATE = "The user will ask you some questions. To this message, respond with 'OK.'\n\nHere is their current context:\n\n{{CONTENT}}";
const SESSION_SECRET = "b57dadd2014a90a2423fdd141163a5e3d4165add460e1447068804754bfadca9" // to retain session across restarts

// Create HMAC signature for auth token
const signToken = (password) => {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(password);
  return hmac.digest('hex');
};

// Verify auth token
const verifyToken = (token) => {
  return token === signToken(PASSWORD);
};

app.use(cookieParser());
app.use(express.json());

// CORS for Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Auth middleware
const checkAuth = (req, res, next) => {
  const token = req.cookies?.auth;
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Login endpoint
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    const token = signToken(PASSWORD);
    res.cookie('auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Check if authenticated
app.get('/api/check-auth', (req, res) => {
  const token = req.cookies?.auth;
  if (token && verifyToken(token)) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Get client-safe config
app.get('/api/config', checkAuth, (req, res) => {
  res.json({
    grokPromptTemplate: GROK_PROMPT_TEMPLATE
  });
});

// Function to read notes from file
const readNotesFromFile = async () => {
  try {
    const notesPath = path.resolve(__dirname, 'notes.md');
    return await fs.readFile(notesPath, 'utf-8');
  } catch (error) {
    // If file doesn't exist or there's an error, return default content
    return '# My Notes\n\nStart writing here...';
  }
};

// Get notes content
app.get('/api/content', checkAuth, async (req, res) => {
  try {
    const content = await readNotesFromFile();
    res.type('text/plain').send(content);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read notes' });
  }
});

// Update notes content (write to notes.md file)
app.post('/api/content', checkAuth, async (req, res) => {
  const { content } = req.body;
  if (content !== undefined) {
    try {
      const notesPath = path.resolve(__dirname, 'notes.md');
      await fs.writeFile(notesPath, content, 'utf-8');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save notes' });
    }
  } else {
    res.status(400).json({ error: 'Content is required' });
  }
});

// SSE endpoint (simplified for serverless)
app.get('/api/content-updates', checkAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Send initial content from file
    const content = await readNotesFromFile();
    res.write(`data: ${JSON.stringify({ content })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ content: '# Error loading notes' })}\n\n`);
  }

  // Simple heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 300000); // every 5 minutes, since it won't ever update

  req.on('close', () => {
    clearInterval(heartbeat);
  });

  // End after 25 seconds (Vercel function limit)
  setTimeout(() => {
    clearInterval(heartbeat);
    res.end();
  }, 25000);
});

// Export for Vercel
module.exports = app;
