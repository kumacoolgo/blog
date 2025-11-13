import Busboy from 'busboy';
let outBuf, outExt;
if(IMAGE_FORMAT === 'orig'){
if((meta.format||'').startsWith('png')){ outBuf = await img.png({ compressionLevel: 8 }).toBuffer(); outExt = '.png'; }
else if((meta.format||'').startsWith('webp')){ outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer(); outExt = '.webp'; }
else { outBuf = await img.jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer(); outExt = '.jpg'; }
} else {
outBuf = await img.webp({ quality: IMAGE_QUALITY }).toBuffer();
outExt = '.webp';
}
const hash = crypto.createHash('sha256').update(outBuf).digest('hex').slice(0, 16);
const now = new Date();
const y = now.getUTCFullYear();
const m = String(now.getUTCMonth()+1).padStart(2,'0');
const d = String(now.getUTCDate()).padStart(2,'0');
const safeBase = (filename || 'upload').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_.-]/g, '').slice(-40) || 'file';
const key = `${y}/${m}/${d}/${hash}-${safeBase.replace(/\.[^.]+$/, '')}${outExt}`;
uploadedUrl = await putObject({ bucket: process.env.R2_BUCKET, key, body: outBuf, contentType: extToMime(outExt) });
_resolve();
}catch(err){ _reject(err); }
});


file.on('limit', ()=> _reject(new Error('文件过大')));
});


bb.on('error', _reject);
bb.on('finish', ()=> _resolve());


req.pipe(bb);


try{
await done;
if(!uploadedUrl) return badRequest(res, '未接收到文件');
return json(res, { url: uploadedUrl });
}catch(err){
res.status(400).end(err.message || '上传失败');
}
}


function extToMime(ext){
switch(ext){
case '.webp': return 'image/webp';
case '.jpg':
case '.jpeg': return 'image/jpeg';
case '.png': return 'image/png';
default: return 'application/octet-stream';
}
}