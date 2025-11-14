# 880913.xyz 克隆（原生 JS + Vercel Serverless + Upstash Redis + R2 上传）

- 登录：右上角，账号/密码在环境变量（单管理员）
- 资料编辑：名字/简介/头像/背景（支持上传至 R2，自动压缩、去 EXIF、WebP）
- 链接管理：图标（Emoji/URL/上传）、名称、URL、删除、保存
- 交互：登录后长按拖拽排序；底部添加链接
- 安全增强：
  - 会话 Cookie HMAC 签名 + 7 天过期 + HttpOnly + 生产环境 Secure
  - 基于 Origin/Referer 的简单 CSRF 防护（APP_ORIGIN）
  - 登录限速（按 IP）防暴力破解
  - 所有链接字段做 URL 校验，只允许 http/https

## 环境变量

见 `.env.example`，在 Vercel 项目中按相同键名添加。

**注意：**

- `SESSION_SECRET` 必须替换为随机长字符串
- `APP_ORIGIN` 必须设置为实际访问域名（本地可以是 `http://localhost:3000`）
- 生产环境会自动给 Cookie 加上 `Secure` 标记

## 本地开发

```bash
npm i
cp .env.example .env.local # 并填好实际值
vercel dev
