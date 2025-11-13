import { requireAuth, json, badRequest } from '../lib/auth.js';
import { getRedis } from '../lib/redis.js';


export default async function handler(req, res){
if(req.method !== 'POST') return badRequest(res, 'Method not allowed');
requireAuth(req, res);
const { name='', bio='', avatarUrl='', backgroundUrl='' } = req.body || {};
const r = getRedis();
await r.set('profile', { name, bio, avatarUrl, backgroundUrl });
return json(res, { ok: true });
}