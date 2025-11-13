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

  // --- [ 修正点 1 ] ---
  // 将 extToMime 函数移动到 handler 内部
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

  // 使用 Promise 来等待 Busboy 完成
  const done = new Promise((_resolve, _reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
    });

    bb.on('file', (name, file, info) => {
      const { filename } = info;

      // 必须使用 async IIFE (立即执行的异步函数) 
      // 才能在 'file' 事件处理器中安全地使用 await
      (async () => {
        try {
          const chunks = [];
          for await (const chunk of file) {
            chunks.push(chunk);
          }
          const buf = Buffer.concat(chunks);

          // 图像处理
          const img = sharp(buf).rotate(); // .rotate() 修正 EXIF 方向
          const meta = await img.metadata();

          if (meta.width && meta.width > IMAGE_MAX_WIDTH) {
            img.resize({ width: IMAGE_MAX_WIDTH });
          }

          // 压缩与格式转换
          let outBuf, outExt;
          if (IMAGE_FORMAT === 'orig') {
            if ((meta.format || '').startsWith('png')) { outBuf = await img.png({ compressionLevel: 8 }).toBuffer(); outExt = '.png'; }
            else if ((meta.format || '').startsWith('webp')) { outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer(); outExt = '.webp'; }
            else { outBuf = await img.jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer(); outExt = '.jpg'; }
          } else {
            outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer();
            outExt = '.webp';
          }

          // 生成唯一文件名
          const hash = crypto.createHash('sha256').update(outBuf).digest('hex').slice(0, 16);
          const now = new Date();
          const y = now.getUTCFullYear();
          const m = String(now.getUTCMonth() + 1).padStart(2, '0');
          const d = String(now.getUTCDate()).padStart(2, '0');
          const safeBase = (filename || 'upload').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_.-]/g, '').slice(-40) || 'file';
          const key = `${y}/${m}/${d}/${hash}-${safeBase.replace(/\.[^.]+$/, '')}${outExt}`;

          // 上传到 R2
          uploadedUrl = await putObject({ bucket: process.env.R2_BUCKET, key, body: outBuf, contentType: extToMime(outExt) });
          _resolve(); // 成功
        
        } catch (err) {
          _reject(err); // 图像处理或上传失败
        }
      })(); // 立即执行

      file.on('limit', () => {
        _reject(new Error('文件过大'));
        bb.destroy(); // 文件过大时，立即停止处理
      });
    }); // bb.on('file') 结束

    bb.on('error', _reject);
    bb.on('finish', () => {
      // 当没有文件（或只有字段）时，finish 可能会在 file 之前触发
      // 我们依赖 'file' 里的 _resolve()
      if (!uploadedUrl) {
         _resolve(); // 允许 'finish'
      }
    });

    req.pipe(bb);
  }); // Promise 结束

  // --- [ 修正点 2 ] ---
  // 这是 handler 函数的 try...catch
  // 并且后面不再有多余的 `}`
  try {
    await done;
    if (!uploadedUrl) return badRequest(res, '未接收到文件');
    return json(res, { url: uploadedUrl });
  } catch (err) {
    res.status(400).end(err.message || '上传失败');
  }
} // 这是 handler 函数的正确结尾