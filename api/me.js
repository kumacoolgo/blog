// api/me.js
import { getSession, json } from '../lib/auth.js';
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const authed = !!getSession(req);
  const r = getRedis();
  const profile = (await r.get('profile')) || {
    name: 'Your Name',
    bio: '',
    avatarUrl: '',
    backgroundUrl: '',
  };
  const ids = (await r.lrange('links:order', 0, -1)) || [];
  const links = ids.length
    ? (await r.mget(...ids.map(id => `link:${id}`))).map((j, i) => ({
        id: ids[i],
        ...(j || {}),
      }))
    : [];
  return json(res, { authed, profile, links });
}
