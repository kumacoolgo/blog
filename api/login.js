// api/login.js
import crypto from 'crypto';
import { setSessionCookie, json, badRequest, getIp, requireSameOrigin } from '../lib/auth.js';
import { getRedis } from '../lib/redis.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_COOLDOWN_SEC = 60; // 60 秒内最多 5 次

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed');

  // CSRF 防护
  try {
    requireSameOrigin(req, res);
  } catch {
    return;
  }

  const r = getRedis();
  const ip = getIp(req);
  const key = `login:ip:${ip}`;

  try {
    // 1. 速率限制检查
    const attempts = await r.get(key);
    if (attempts && Number(attempts) >= MAX_LOGIN_ATTEMPTS) {
      res.status(429).end('尝试次数过多，请稍后再试');
      return;
    }

    // 2. 凭证检查
    const { username, password } = req.body || {};
    const u = process.env.ADMIN_USER;
    const p = process.env.ADMIN_PASS;

    if (!u || !p) return badRequest(res, '管理员账号未配置');

    const isUserMatch = username === u;

    const pBuf = Buffer.from(String(p));
    const inputBufSrc = Buffer.from(String(password || ''));
    const inputBuf = inputBufSrc.length === pBuf.length
      ? inputBufSrc
      : Buffer.alloc(pBuf.length);

    let isPassMatch = false;
    try {
      isPassMatch = crypto.timingSafeEqual(pBuf, inputBuf);
    } catch {
      isPassMatch = false;
    }

    if (isUserMatch && isPassMatch) {
      // 登录成功，清理限速计数
      await r.del(key);
      setSessionCookie(res, { username });
      return json(res, { ok: true });
    }

    // 3. 登录失败，累计次数
    const newAttempts = await r.incr(key);
    if (Number(newAttempts) === 1) {
      await r.expire(key, LOGIN_COOLDOWN_SEC);
    }

    return badRequest(res, '账号或密码错误');
  } catch (err) {
    console.error('[/api/login] handler error:', err);
    if (!res.headersSent) {
      res.status(500).end('Server error');
    }
  }
}
