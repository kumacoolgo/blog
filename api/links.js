import { nanoid } from 'nanoid';
const r = getRedis();


if(req.method === 'GET'){
const ids = await r.lrange('links:order', 0, -1);
const links = ids.length ? (await r.mget(...ids.map(id=>`link:${id}`))).map((j, i)=> ({ id: ids[i], ...(j||{}) })) : [];
return json(res, { links });
}


// 以下均需登录
requireAuth(req, res);


if(req.method === 'POST'){
const { icon='', title='', url='' } = req.body || {};
if(!title || !url) return badRequest(res, '缺少字段');
const id = nanoid(10);
await r.set(`link:${id}`, { icon, title, url });
await r.rpush('links:order', id);
return json(res, { id });
}


if(req.method === 'PUT'){
const { id, icon='', title='', url='' } = req.body || {};
if(!id) return badRequest(res, '缺少 id');
await r.set(`link:${id}`, { icon, title, url });
return json(res, { ok: true });
}


if(req.method === 'DELETE'){
const { id } = req.body || {};
if(!id) return badRequest(res, '缺少 id');
await r.del(`link:${id}`);
await r.lrem('links:order', 0, id);
return json(res, { ok: true });
}


if(req.method === 'PATCH'){
const { order } = req.body || {};
if(!Array.isArray(order)) return badRequest(res, '需提供 order 列表');
await r.del('links:order');
if(order.length) await r.rpush('links:order', ...order);
return json(res, { ok: true });
}


return badRequest(res, 'Method not allowed');
}