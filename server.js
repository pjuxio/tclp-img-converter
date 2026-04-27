const crypto = require('crypto');
const path = require('path');

const express = require('express');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');
const sgMail = require('@sendgrid/mail');
const multer = require('multer');
const sharp = require('sharp');

// ── Environment ────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const ALLOWED_EMAILS = new Set(
  (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);

// ── Startup checks ─────────────────────────────────────────────────────────────
if (!SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET is not set. Generate one with: openssl rand -hex 32');
  process.exit(1);
}
if (!SENDGRID_API_KEY) {
  if (!isDev) { console.error('FATAL: SENDGRID_API_KEY is not set.'); process.exit(1); }
  console.warn('WARNING: SENDGRID_API_KEY not set — emails disabled in dev mode');
}
if (!FROM_EMAIL) {
  if (!isDev) { console.error('FATAL: FROM_EMAIL is not set.'); process.exit(1); }
}

if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

// ── Auth helpers ───────────────────────────────────────────────────────────────
function isAllowed(email) {
  const lower = email.toLowerCase();
  if (lower.endsWith('@thechisholmlegacyproject.org')) return true;
  if (ALLOWED_EMAILS.has(lower)) return true;
  return false;
}

const TOKEN_TTL_MS = 15 * 60 * 1000;

function createToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + TOKEN_TTL_MS,
  })).toString('base64url');

  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  return `${payload}.${sig}`;
}

function consumeToken(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  if (sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }

  if (Date.now() > data.exp) return null;

  return data.email;
}

// ── App setup ──────────────────────────────────────────────────────────────────
const app = express();

app.set('trust proxy', 1);

app.use(cookieSession({
  name: 'session',
  secret: SESSION_SECRET,
  httpOnly: true,
  secure: !isDev,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}));

app.use(express.json());

// Serve static assets (CSS, JS, SVGs) without auth, but skip auto-serving index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── Rate limiter ───────────────────────────────────────────────────────────────
const magicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in requests. Please try again in 15 minutes.' },
});

// ── Auth routes (before guard) ─────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session.email) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/auth/request', magicLinkLimiter, async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!isAllowed(email)) {
    return res.status(403).json({ error: 'This email address is not authorised.' });
  }

  const token = createToken(email);
  const link = `${APP_URL}/auth/verify?token=${token}`;

  if (isDev && !SENDGRID_API_KEY) {
    console.log(`[dev] Magic link for ${email}: ${link}`);
    return res.json({ ok: true });
  }

  try {
    await sgMail.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your sign-in link — TCLP Image Optimizer',
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        subscriptionTracking: { enable: false },
      },
      mailSettings: {
        bypassListManagement: { enable: true },
      },
      html: `<p>Click to sign in to the TCLP Image Optimizer (link expires in 15 minutes):</p>
             <p><a href="${link}">Sign in</a></p>
             <p style="color:#666;font-size:0.85em;">If you didn't request this, you can ignore it.</p>`,
    });
  } catch (err) {
    console.error('SendGrid error:', err);
    return res.status(500).json({ error: 'Could not send sign-in email. Please try again.' });
  }

  res.json({ ok: true });
});

app.get('/auth/verify', (req, res) => {
  const email = consumeToken(req.query.token || '');
  if (!email) return res.redirect('/login?error=expired');

  req.session.email = email;
  res.redirect('/');
});

app.get('/auth/signout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// ── Auth guard ─────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (isDev || req.session.email) return next();
  res.redirect('/login');
});

// ── Protected routes ───────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Image conversion ───────────────────────────────────────────────────────────
const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/webp',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

app.post('/convert', upload.array('images', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const quality = Math.min(100, Math.max(1, parseInt(req.body.quality, 10) || 80));
  const lossless = req.body.lossless === 'true';

  const resizeWidth  = parseInt(req.body.resizeWidth, 10)  || null;
  const resizeHeight = parseInt(req.body.resizeHeight, 10) || null;
  const maintainAR   = req.body.maintainAR !== 'false';
  const noUpscale    = req.body.noUpscale  !== 'false';

  try {
    const results = await Promise.all(
      req.files.map(async (file) => {
        const baseName = path.parse(file.originalname).name;

        let pipeline = sharp(file.buffer);

        if (resizeWidth || resizeHeight) {
          const resizeOpts = {
            width:  resizeWidth  || undefined,
            height: resizeHeight || undefined,
            withoutEnlargement: noUpscale,
          };
          if (resizeWidth && resizeHeight) {
            resizeOpts.fit = maintainAR ? 'inside' : 'fill';
          }
          pipeline = pipeline.resize(resizeOpts);
        }

        const { data: webpBuffer, info } = await pipeline
          .webp({ quality, lossless })
          .toBuffer({ resolveWithObject: true });

        return {
          originalName: file.originalname,
          outputName: `${baseName}.webp`,
          data: webpBuffer.toString('base64'),
          originalSize: file.size,
          convertedSize: webpBuffer.length,
          outputWidth: info.width,
          outputHeight: info.height,
        };
      })
    );

    res.json({ files: results });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ error: 'Conversion failed. The file may be corrupt or unsupported.' });
  }
});

// ── Error handler ──────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
  }
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`TCLP Image Converter running at http://localhost:${PORT}`);
});
