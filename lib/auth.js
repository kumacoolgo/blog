import crypto from 'crypto';


const COOKIE = 'session';
const MAX_AGE = 7 * 24 * 3600; // 7 天


export function json(res, data){ res.setHeader('Content-Type','application/json'); res.status(200).end(JSON.stringify(data)); }
export function badRequest(res, msg){ res.status(400).end(msg || 'Bad Request'); }


function sign(payload){
const secret = process.env.SESSION_SECRET || 'dev-secret';
const h = crypto.createHmac('sha256', secret); h.update(payload); return h.digest('hex');
}


export function setSessionCookie(res, data){
const exp = Math.floor(Date.now()/1000) + MAX_AGE;
const body = Buffer.from(JSON.stringify({ ...data, exp })).toString('base64url');
const sig = sign(body);
const cookie = `${COOKIE}=${body}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
res.setHeader('Set-Cookie', cookie);
}


export function clearSessionCookie(res){ res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`); }


export function getSession(req){
const c = parseCookie(req.headers.cookie||'')[COOKIE];
if(!c) return null;
const [body, sig] = c.split('.');
if(sign(body) !== sig) return null;
const json = JSON.parse(Buffer.from(body, 'base64url').toString());
if((json.exp||0) < Math.floor(Date.now()/1000)) return null;
return json;
}


export function requireAuth(req, res){
const s = getSession(req);
if(!s){ res.status(401).end('未登录'); throw new Error('unauth'); }
}


function parseCookie(str){
return (str || '').split(';').reduce((acc, kv)=>{
const parts = kv.trim().split('=');
const k = parts[0];
const v = parts.slice(1).join('=');
if(!k) return acc; acc[k] = v; return acc;
}, {});
}