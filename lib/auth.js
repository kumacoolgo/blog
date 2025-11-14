// lib/auth.js
import crypto from 'crypto';

const COOKIE = 'session';
const MAX_AGE = 7 * 24 * 3600; // 7 天

export function json(res, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).end(JSON.stringify(data));
}

export function badRequest(res, msg) {
  res.status(400).end(msg || 'Bad Request');
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET || 'dev-secret';
  const h = crypto.createHmac('sha256', secret);
  h.update(payload);
  return h.digest('hex');
}

export function setSessionCookie(res, data) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = Buffer.from(JSON.stringify({ ...data, exp })).toString('base64url');
  const sig = sign(body);
  let cookie = `${COOKIE}=${body}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;

  // 生产环境加 Secure，防止非 HTTPS 泄露 Cookie
  if (process.env.NODE_ENV === 'production') {
    cookie += '; Secure';
  }

  res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res) {
  let cookie = `${COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
  if (process.env.NODE_ENV === 'production') {
    cookie += '; Secure';
  }
  res.setHeader('Set-Cookie', cookie);
}

export function getSession(req) {
  const raw = parseCookie(req.headers.cookie || '')[COOKIE];
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  if (sign(body) !== sig) return null;

  let json;
  try {
    json = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }

  if ((json.exp || 0) < Math.floor(Date.now() / 1000)) return null;
  return json;
}

export function requireAuth(req, res) {
  const s = getSession(req);
  if (!s) {
    res.status(401).end('未登录');
    throw new Error('unauth');
  }
  return s;
}

/**
 * 基于 Origin/Referer 的简单 CSRF 防护。
 * 需要 APP_ORIGIN（例如 https://your-domain.com）。
 */
export function requireSameOrigin(req, res) {
  const allowed = (process.env.APP_ORIGIN || '').toLowerCase().replace(/\/$/, '');
  if (!allowed) return; // 未配置时不做校验（本地开发方便）

  const originHeader = (req.headers.origin || '').toLowerCase();
  const refererHeader = (req.headers.referer || '').toLowerCase();
  const origin = extractOrigin(originHeader || refererHeader);
  if (!origin) {
    // 某些环境下可能没有 Origin/Referer，这里选择放行
    return;
  }

  if (origin !== allowed) {
    res.status(403).end('Invalid Origin');
    throw new Error('bad-origin');
  }
}

function extractOrigin(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.origin.toLowerCase().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function parseCookie(str) {
  return (str || '').split(';').reduce((acc, kv) => {
    const parts = kv.trim().split('=');
    const k = parts[0];
    const v = parts.slice(1).join('=');
    if (!k) return acc;
    acc[k] = v;
    return acc;
  }, {});
}

/**
 * 从请求中获取 IP（用于登录限速）
 */
export function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return value.split(/,\s*/)[0];
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * 简单检查是否 http/https URL
 * 注意这里只做第一层过滤，严格规范使用 URL 构造在业务代码里做
 */
const httpUrlRegex = /^https?:\/\//i;
export function isValidHttpUrl(str) {
  if (!str) return false;
  return httpUrlRegex.test(String(str).trim());
}