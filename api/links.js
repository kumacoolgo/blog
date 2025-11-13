// api/links.js
import { nanoid } from 'nanoid';
import { requireAuth, json, badRequest } from '../lib/auth.js';
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const r = getRedis();

  try {
    // 1. GET：公开获取链接列表
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

    // 2. 下面这些操作都需要登录
    requireAuth(req, res);

    // 3. POST：新增
    if (req.method === 'POST') {
      const body = req.body || {};
      const { icon = '', title = '', url = '' } = body;

      if (!title || !url) return badRequest(res, '缺少字段');

      const id = nanoid(10);
      await r.set(`link:${id}`, { icon, title, url });
      await r.rpush('links:order', id);
      return json(res, { id });
    }

    // 4. PUT：更新
    if (req.method === 'PUT') {
      const body = req.body || {};
      const { id, icon = '', title = '', url = '' } = body;
      if (!id) return badRequest(res, '缺少 id');
      await r.set(`link:${id}`, { icon, title, url });
      return json(res, { ok: true });
    }

    // 5. DELETE：删除
    if (req.method === 'DELETE') {
      const body = req.body || {};
      const { id } = body;
      if (!id) return badRequest(res, '缺少 id');
      await r.del(`link:${id}`);
      await r.lrem('links:order', 0, id);
      return json(res, { ok: true });
    }

    // 6. PATCH：重排顺序
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
    res.status(500).end('Server error: ' + (err?.message || 'unknown'));
  }
}
