const crypto = require('crypto');
const { verifyUserPassword, getUserByEmail } = require('./db');

const AUTH_SECRET = process.env.AUTH_SECRET || 'capstone_jwt_secret_key_2026';
const TOKEN_EXPIRY_HOURS = 24;

// Simple HMAC-based token generator & verifier without external JWT library dependency
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (TOKEN_EXPIRY_HOURS * 3600);
  const fullPayload = { ...payload, exp };
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payloadB64}`)
    .digest('base64url');
  return `${header}.${payloadB64}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payloadB64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${payloadB64}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}

// Authentication Controller
function handleLogin(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = verifyUserPassword(email.trim().toLowerCase(), password.trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });

  return res.status(200).json({
    message: 'Authentication successful',
    token,
    user
  });
}

// Express Auth Middleware
function requireCapstoneAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
  }

  const decoded = verifyToken(token.trim());
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.user = decoded;
  next();
}

module.exports = {
  createToken,
  verifyToken,
  handleLogin,
  requireCapstoneAuth
};
