// api/logout.js
import { clearSessionCookie, json, requireSameOrigin } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    requireSameOrigin(req, res);
  } catch {
    return;
  }

  clearSessionCookie(res);
  return json(res, { ok: true });
}
