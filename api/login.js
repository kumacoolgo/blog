import { setSessionCookie, json, badRequest } from '../lib/auth.js';


export default async function handler(req, res){
if(req.method !== 'POST') return badRequest(res, 'Method not allowed');
const { username, password } = req.body || {};
const u = process.env.ADMIN_USER;
const p = process.env.ADMIN_PASS;
if(!u || !p) return badRequest(res, '管理员账号未配置');
if(username === u && password === p){
setSessionCookie(res, { username });
return json(res, { ok: true });
}
return badRequest(res, '账号或密码错误');
}