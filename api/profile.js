// api/profile.js
import { requireAuth, requireSameOrigin, json, badRequest } from '../lib/auth.js';
import { getRedis } from '../lib/redis.js';

const MAX_NAME_LEN = 50;
const MAX_BIO_LEN = 500;

function sanitizeText(str, maxLen) {
  str = String(str || '').trim();
  if (str.length > maxLen) str = str.slice(0, maxLen);
  return str;
}

function sanitizeUrl(str, allowEmpty = true) {
  const v = String(str || '').trim();
  if (!v) {
    if (allowEmpty) return '';
    throw new Error('empty');
  }
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('protocol');
    }
    return u.toString();
  } catch {
    throw new Error('invalid-url');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed');

  try {
    requireSameOrigin(req, res);
    requireAuth(req, res);
  } catch {
    return;
  }

  const body = req.body || {};
  let { name = '', bio = '', avatarUrl = '', backgroundUrl = '' } = body;

  name = sanitizeText(name, MAX_NAME_LEN);
  bio = sanitizeText(bio, MAX_BIO_LEN);

  try {
    avatarUrl = avatarUrl ? sanitizeUrl(avatarUrl) : '';
    backgroundUrl = backgroundUrl ? sanitizeUrl(backgroundUrl) : '';
  } catch {
    return badRequest(res, 'URL 格式不正确，必须是 http/https 开头');
  }

  const r = getRedis();
  await r.set('profile', { name, bio, avatarUrl, backgroundUrl });
  return json(res, { ok: true });
}
