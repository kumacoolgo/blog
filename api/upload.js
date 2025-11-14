// api/upload.js
import Busboy from 'busboy';
import crypto from 'crypto';
import sharp from 'sharp';
import { requireAuth, requireSameOrigin, json, badRequest } from '../lib/auth.js';
import { putObject } from '../lib/r2.js';

// 环境变量
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '8', 10);
const IMAGE_MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH || '1600', 10);
const IMAGE_FORMAT = process.env.IMAGE_FORMAT || 'webp';
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY || '82', 10);

function extToMime(ext) {
  switch (ext) {
    case '.webp': return 'image/webp';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    default: return 'application/octet-stream';
  }
}

export default async function handler(req, res) {
  // 上传需要同源 + 登录
  try {
    requireSameOrigin(req, res);
    requireAuth(req, res);
  } catch {
    return;
  }

  let uploadedUrl = null;
  let fileReceived = false;

  const done = new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
    });

    bb.on('file', (name, file, info) => {
      fileReceived = true;
      const { filename } = info;

      (async () => {
        try {
          const chunks = [];
          for await (const chunk of file) {
            chunks.push(chunk);
          }
          const buf = Buffer.concat(chunks);

          // 使用 sharp 解析元信息，并限制类型
          const img = sharp(buf).rotate();
          const meta = await img.metadata();

          const format = (meta.format || '').toLowerCase();
          if (!['jpeg', 'jpg', 'png', 'webp'].includes(format)) {
            throw new Error('不支持的图片格式');
          }

          if (meta.width && meta.width > IMAGE_MAX_WIDTH) {
            img.resize({ width: IMAGE_MAX_WIDTH });
          }

          let outBuf, outExt;
          if (IMAGE_FORMAT === 'orig') {
            if (format === 'png') {
              outBuf = await img.png({ compressionLevel: 8 }).toBuffer();
              outExt = '.png';
            } else if (format === 'webp') {
              outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer();
              outExt = '.webp';
            } else {
              outBuf = await img.jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer();
              outExt = '.jpg';
            }
          } else {
            outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer();
            outExt = '.webp';
          }

          const hash = crypto.createHash('sha256').update(outBuf).digest('hex').slice(0, 16);
          const now = new Date();
          const y = now.getUTCFullYear();
          const m = String(now.getUTCMonth() + 1).padStart(2, '0');
          const d = String(now.getUTCDate()).padStart(2, '0');

          const safeBase = (filename || 'upload')
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9_.-]/g, '')
            .slice(-40) || 'file';

          const key = `${y}/${m}/${d}/${hash}-${safeBase.replace(/\.[^.]+$/, '')}${outExt}`;
          uploadedUrl = await putObject({
            bucket: process.env.R2_BUCKET,
            key,
            body: outBuf,
            contentType: extToMime(outExt),
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      })();

      file.on('limit', () => {
        reject(new Error('文件过大'));
        bb.destroy();
      });
    });

    bb.on('error', reject);
    bb.on('finish', () => {
      if (!fileReceived) {
        resolve();
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
