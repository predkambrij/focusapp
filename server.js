const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Load configuration
const CONFIG_FILE = path.join(__dirname, 'config.json');
if (!fs.existsSync(CONFIG_FILE)) {
  console.error('ERROR: config.json not found. Please create it from config.example.json');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
} catch (err) {
  console.error('ERROR: Failed to parse config.json:', err.message);
  process.exit(1);
}

// Validate required config values
const requiredFields = ['server.host', 'server.port', 'notesFile', 'password', 'grokPromptTemplate'];
for (const field of requiredFields) {
  const keys = field.split('.');
  let value = config;
  for (const key of keys) {
    value = value?.[key];
  }
  if (value === undefined || value === null || value === '') {
    console.error(`ERROR: Missing required config field: ${field}`);
    process.exit(1);
  }
}

const HOST = config.server.host;
const PORT = config.server.port;
const PASSWORD = config.password;
const NOTES_FILE = path.isAbsolute(config.notesFile) 
  ? config.notesFile 
  : path.join(__dirname, config.notesFile);
const GROK_PROMPT_TEMPLATE = config.grokPromptTemplate;

// Get or generate persistent session secret
let SESSION_SECRET = config.sessionSecret;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  config.sessionSecret = SESSION_SECRET;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
    console.log('Generated new session secret and saved to config.json');
  } catch (err) {
    console.error('Warning: Could not save session secret to config.json:', err.message);
  }
}

// Create HMAC signature for auth token
const signToken = (password) => {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(password);
  return hmac.digest('hex');
};

// Verify auth token using timing-safe comparison
const verifyToken = (token) => {
  if (!token) return false;
  const expectedToken = signToken(PASSWORD);
  try {
    // Both buffers must be the same length for timingSafeEqual
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedToken);
    
    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch (err) {
    return false;
  }
};

app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Auth middleware
const checkAuth = (req, res, next) => {
  const token = req.cookies?.auth;
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Login endpoint - validates password and returns signed token
app.post('/api/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  
  // Use timing-safe comparison for password check
  if (!password) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  try {
    const passwordBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(PASSWORD);
    
    // Ensure both buffers are same length before comparison
    if (passwordBuffer.length !== expectedBuffer.length) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    if (crypto.timingSafeEqual(passwordBuffer, expectedBuffer)) {
      const token = signToken(PASSWORD);
      res.cookie('auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
      });
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (err) {
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

// Get client-safe config (excludes sensitive data)
app.get('/api/config', checkAuth, (req, res) => {
  res.json({
    grokPromptTemplate: GROK_PROMPT_TEMPLATE
  });
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

app.listen(PORT, HOST, () => {
  console.log(`Focus App running at http://${HOST}:${PORT}`);
  console.log(`Listening on: ${HOST}:${PORT}`);
  console.log(`Notes file: ${NOTES_FILE}`);
});
