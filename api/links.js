// api/links.js
import { nanoid } from 'nanoid';
import {
  requireAuth,
  requireSameOrigin,
  json,
  badRequest,
  isValidHttpUrl,
} from '../lib/auth.js';
import { getRedis } from '../lib/redis.js';

const TITLE_MAX = 100;
const ICON_MAX = 200;

function sanitizeText(str, maxLen) {
  str = String(str || '').trim();
  if (str.length > maxLen) str = str.slice(0, maxLen);
  return str;
}

function validateUrl(str) {
  const v = String(str || '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
    return u.toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const r = getRedis();

  try {
    // GET：公开获取链接列表
    if (req.method === 'GET') {
      const ids = await r.lrange('links:order', 0, -1);
      const links = ids.length
        ? (await r.mget(...ids.map(id => `link:${id}`))).map((j, i) => ({
            id: ids[i],
            ...(j || {}),
          }))
        : [];
      return json(res, { links });
    }

    // 非 GET 需要同源校验 + 登录
    requireSameOrigin(req, res);
    requireAuth(req, res);

    // POST：新增
    if (req.method === 'POST') {
      const body = req.body || {};
      let { icon = '', title = '', url = '' } = body;

      title = sanitizeText(title, TITLE_MAX);
      icon = sanitizeText(icon, ICON_MAX);
      const safeUrl = validateUrl(url);

      if (!title || !safeUrl) {
        return badRequest(res, '缺少字段或链接格式不正确');
      }

      // 图标允许：短 emoji 文本 或 合法 URL
      if (icon && !isValidHttpUrl(icon) && icon.length > 5) {
        return badRequest(res, '图标格式不正确');
      }

      const id = nanoid(10);
      await r.set(`link:${id}`, { icon, title, url: safeUrl });
      await r.rpush('links:order', id);
      return json(res, { id });
    }

    // PUT：更新
    if (req.method === 'PUT') {
      const body = req.body || {};
      const { id } = body;
      if (!id) return badRequest(res, '缺少 id');

      let { icon = '', title = '', url = '' } = body;
      title = sanitizeText(title, TITLE_MAX);
      icon = sanitizeText(icon, ICON_MAX);
      const safeUrl = validateUrl(url);

      if (!title || !safeUrl) {
        return badRequest(res, '缺少字段或链接格式不正确');
      }

      if (icon && !isValidHttpUrl(icon) && icon.length > 5) {
        return badRequest(res, '图标格式不正确');
      }

      await r.set(`link:${id}`, { icon, title, url: safeUrl });
      return json(res, { ok: true });
    }

    // DELETE：删除
    if (req.method === 'DELETE') {
      const body = req.body || {};
      const { id } = body;
      if (!id) return badRequest(res, '缺少 id');
      await r.del(`link:${id}`);
      await r.lrem('links:order', 0, id);
      return json(res, { ok: true });
    }

    // PATCH：重排顺序
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const { order } = body;
      if (!Array.isArray(order)) return badRequest(res, '需提供 order 列表');
      await r.del('links:order');
      if (order.length) await r.rpush('links:order', ...order);
      return json(res, { ok: true });
    }

    return badRequest(res, 'Method not allowed');
  } catch (err) {
    console.error('[/api/links] handler error:', err);
    if (!res.headersSent) {
      res.status(500).end('Server error: ' + (err?.message || 'unknown'));
    }
  }
}
