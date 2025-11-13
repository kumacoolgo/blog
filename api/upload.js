import Busboy from 'busboy';
import crypto from 'crypto';
import sharp from 'sharp';
import { requireAuth, json, badRequest } from '../lib/auth.js';
import { putObject } from '../lib/r2.js';

// 环境变量
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '8', 10);
const IMAGE_MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH || '1600', 10);
const IMAGE_FORMAT = process.env.IMAGE_FORMAT || 'webp';
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY || '82', 10);

export default async function handler(req, res) {
  // 上传需要登录
  try {
    requireAuth(req, res);
  } catch (err) {
    return; // requireAuth 会自动响应
  }

  function extToMime(ext) {
    switch (ext) {
      case '.webp': return 'image/webp';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      default: return 'application/octet-stream';
    }
  }

  let uploadedUrl = null;
  let fileReceived = false; // <--- [修正点 1] 添加一个标志

  const done = new Promise((_resolve, _reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
    });

    bb.on('file', (name, file, info) => {
      fileReceived = true; // <--- [修正点 2] 标记我们收到了文件
      const { filename } = info;

      (async () => {
        try {
          const chunks = [];
          for await (const chunk of file) {
            chunks.push(chunk);
          }
          const buf = Buffer.concat(chunks);

          // ... (图像处理和 R2 上传的代码不变) ...
          const img = sharp(buf).rotate();
          const meta = await img.metadata();
          if (meta.width && meta.width > IMAGE_MAX_WIDTH) {
            img.resize({ width: IMAGE_MAX_WIDTH });
          }
          let outBuf, outExt;
          if (IMAGE_FORMAT === 'orig') {
            if ((meta.format || '').startsWith('png')) { outBuf = await img.png({ compressionLevel: 8 }).toBuffer(); outExt = '.png'; }
            else if ((meta.format || '').startsWith('webp')) { outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer(); outExt = '.webp'; }
            else { outBuf = await img.jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer(); outExt = '.jpg'; }
          } else {
            outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer();
            outExt = '.webp';
          }
          const hash = crypto.createHash('sha256').update(outBuf).digest('hex').slice(0, 16);
          const now = new Date();
          //const y = now.getUTCFullYear();
          //const m = String(now.getUTCFullYear() + 1).padStart(2, '0');
          //const d = String(now.getUTCDate()).padStart(2, '0');
          const y = now.getUTCFullYear();
          const m = String(now.getUTCMonth() + 1).padStart(2, '0');
          const d = String(now.getUTCDate()).padStart(2, '0');
          const safeBase = (filename || 'upload').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_.-]/g, '').slice(-40) || 'file';
          const key = `${y}/${m}/${d}/${hash}-${safeBase.replace(/\.[^.]+$/, '')}${outExt}`;
          uploadedUrl = await putObject({ bucket: process.env.R2_BUCKET, key, body: outBuf, contentType: extToMime(outExt) });
          
          _resolve(); // 只有当上传成功后，才 resolve
        
        } catch (err) {
          _reject(err);
        }
      })();

      file.on('limit', () => {
        _reject(new Error('文件过大'));
        bb.destroy();
      });
    });

    bb.on('error', _reject);
    bb.on('finish', () => {
      // --- [修正点 3] ---
      // 只有在 *没有* 收到文件的情况下，finish 才负责 resolve。
      // 如果收到了文件，'file' 事件会负责 resolve。
      if (!fileReceived) {
        _resolve();
      }
    });

    req.pipe(bb);
  });

  try {
    await done;
    if (!uploadedUrl) return badRequest(res, '未接收到文件');
    return json(res, { url: uploadedUrl });
  } catch (err) {
    res.status(400).end(err.message || '上传失败');
  }
}