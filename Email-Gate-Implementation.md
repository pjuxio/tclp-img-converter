# Email Gate — Implementation Reference

Magic link authentication for a Node.js + Express app. No auth vendor, no database — everything is self-contained using Node's built-in `crypto` module and signed cookies.

---

## How it works (user flow)

1. User visits any protected route → redirected to `/login`
2. User enters their email → `POST /auth/request`
3. Server validates the email against an allowlist, creates a signed token, sends a magic link via SendGrid
4. User clicks the link → `GET /auth/verify?token=...`
5. Server verifies the token signature and expiry, writes `email` into a signed session cookie
6. User is redirected to `/` and stays authenticated for 7 days
7. Sign out at `GET /auth/signout` — clears the cookie

---

## Dependencies

```bash
npm install express cookie-session express-rate-limit @sendgrid/mail
```

| Package | Purpose |
|---|---|
| `cookie-session` | Stores session data in a signed cookie — stateless, no DB needed, survives server restarts |
| `express-rate-limit` | Caps magic link requests to prevent email flooding |
| `@sendgrid/mail` | Sends the magic link email |

Node's built-in `crypto` module handles HMAC signing — no extra package needed.

You also need `express.json()` middleware so `req.body.email` is populated. Without it every request returns 400:

```js
app.use(express.json()); // built into express — no extra install
```

---

## Environment variables

| Var | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | Long random string — signs session cookies and HMAC tokens. Generate with `openssl rand -hex 32` |
| `SENDGRID_API_KEY` | Yes (prod) | From SendGrid dashboard |
| `FROM_EMAIL` | Yes (prod) | Verified sender address in SendGrid |
| `APP_URL` | No | Full origin URL e.g. `https://your-app.herokuapp.com`. Defaults to `http://localhost:PORT` |
| `ALLOWED_EMAILS` | No | Comma-separated list of individual external emails to allow beyond the domain rule |

---

## Who is allowed in

Two rules, either passes:

```js
function isAllowed(email) {
    const lower = email.toLowerCase();
    if (lower.endsWith('@yourdomain.org')) return true;  // whole domain
    if (ALLOWED_EMAILS.has(lower)) return true;           // individual exceptions
    return false;
}
```

`ALLOWED_EMAILS` is built at startup from the env var:

```js
const ALLOWED_EMAILS = new Set(
    (process.env.ALLOWED_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
);
```

---

## Token design

Tokens are HMAC-signed and self-contained — no server-side storage, no database. They survive server restarts because validity is proven by the signature, not by looking up a stored value.

**Format:** `base64url(payload).base64url(hmac)`

**Payload:** `{ email, exp }` — email address and Unix expiry timestamp (ms)

**TTL:** 15 minutes

**Single-use?** No — because there is no server-side state, a valid token can be used multiple times within the 15-minute window. This is an intentional trade-off for a stateless design. It's acceptable for an internal tool; if you need single-use links you'd need to store consumed tokens (e.g. in Redis or a DB) and reject reuse.

```js
const TOKEN_TTL_MS = 15 * 60 * 1000;

function createToken(email) {
    const payload = Buffer.from(JSON.stringify({
        email,
        exp: Date.now() + TOKEN_TTL_MS
    })).toString('base64url');

    const sig = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('base64url');

    return `${payload}.${sig}`;
}

function consumeToken(token) {
    const parts = (token || '').split('.');
    if (parts.length !== 2) return null;           // reject malformed tokens
    const [payload, sig] = parts;
    if (!payload || !sig) return null;

    const expected = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('base64url');

    // Length must match before timingSafeEqual — mismatched lengths throw RangeError
    if (sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
        return null;
    }

    if (Date.now() > data.exp) return null;        // expired

    return data.email;
}
```

---

## Session (cookie-session)

Session data (just the email) is stored entirely in a signed cookie. No server-side storage required.

```js
app.use(cookieSession({
    name: 'session',
    secret: SESSION_SECRET,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000                // 7 days
}));
```

**Important for Heroku (or any SSL-terminating proxy):** add this before your middleware, otherwise `secure: true` cookies won't be set:

```js
app.set('trust proxy', 1);
```

---

## Rate limiting

Applied only to the magic link request endpoint — 5 requests per IP per 15 minutes:

```js
const magicLinkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-in requests. Please try again in 15 minutes.' },
});

app.post('/auth/request', magicLinkLimiter, async (req, res) => { ... });
```

---

## Auth routes

All four routes must be registered **before** the auth guard middleware.

### `GET /login`
Serves the login page HTML. If the user already has a valid session, redirects to `/`.

### `POST /auth/request`
```js
app.post('/auth/request', magicLinkLimiter, async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!isAllowed(email)) {
        // Returns 403 — intentionally tells the caller the email isn't on the list.
        // For a more locked-down deployment, return 200 with a generic "check your inbox"
        // message so the allowlist isn't enumerable.
        return res.status(403).json({ error: 'This email address is not authorised.' });
    }

    const token = createToken(email);
    const link = `${APP_URL}/auth/verify?token=${token}`;

    try {
        await sgMail.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Your sign-in link',
            trackingSettings: {
                clickTracking: { enable: false, enableText: false },
                subscriptionTracking: { enable: false }
            },
            mailSettings: {
                bypassListManagement: { enable: true }
            },
            html: `<p>Click to sign in (expires in 15 minutes):</p>
                   <p><a href="${link}">Sign in</a></p>`,
        });
    } catch (err) {
        console.error('SendGrid error:', err);
        return res.status(500).json({ error: 'Could not send sign-in email. Please try again.' });
    }

    res.json({ ok: true });
});
```

**SendGrid settings note:** `bypassListManagement` and disabling `subscriptionTracking` are set so SendGrid doesn't append an unsubscribe footer to transactional emails. Include these or the email will look like a marketing message.

### `GET /auth/verify`
```js
app.get('/auth/verify', (req, res) => {
    const email = consumeToken(req.query.token || '');
    if (!email) return res.redirect('/login?error=expired');

    req.session.email = email;
    res.redirect('/');
});
```

### `GET /auth/signout`
```js
app.get('/auth/signout', (req, res) => {
    req.session = null;   // cookie-session: set to null to clear
    res.redirect('/login');
});
```

---

## Auth guard middleware

Register this **after** the auth routes. Everything below it is protected.

```js
app.use((req, res, next) => {
    if (req.session.email) return next();
    res.redirect('/login');
});
```

---

## Dev mode bypass

Set `NODE_ENV` to anything other than `production` (or just leave it unset) to skip auth and email checks locally. This lets you run with only `SESSION_SECRET` set.

```js
const isDev = process.env.NODE_ENV !== 'production';

// In the auth guard:
app.use((req, res, next) => {
    if (isDev || req.session.email) return next();
    res.redirect('/login');
});

// In startup checks:
if (!SENDGRID_API_KEY) {
    if (!isDev) { console.error('FATAL: ...'); process.exit(1); }
    console.warn('WARNING: email disabled in dev mode');
}
```

---

## Login page (client-side JS)

The login page intercepts the form submit and posts JSON via `fetch` so it can show inline success/error messages without a page reload.

```js
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;

    const res = await fetch('/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value.trim() })
    });
    const data = await res.json();

    if (res.ok) {
        // Show success: "Check your inbox"
    } else {
        // Show error: data.error
    }

    submitBtn.disabled = false;
});
```

On a successful request, show a message like "Check your inbox — a sign-in link is on its way" and reset the form. Do not redirect.

If the user lands on `/login?error=expired`, show an error message explaining the link expired.

---

## Checklist for a new app

- [ ] Install: `cookie-session`, `express-rate-limit`, `@sendgrid/mail`
- [ ] Add `app.use(express.json())` before auth routes
- [ ] Set `app.set('trust proxy', 1)` if behind a proxy (Heroku, Render, etc.)
- [ ] Set env vars: `SESSION_SECRET`, `SENDGRID_API_KEY`, `FROM_EMAIL`, `APP_URL`
- [ ] Update `isAllowed()` with your domain and/or individual emails
- [ ] Register auth routes before the guard middleware
- [ ] Register the guard middleware before all protected routes
- [ ] Serve `login.html` and any assets it needs (logos, fonts) before the guard
- [ ] Verify sender domain/address in SendGrid before going live
