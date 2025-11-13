import { clearSessionCookie, json } from '../lib/auth.js';
export default async function handler(req, res){
clearSessionCookie(res);
return json(res, { ok: true });
}