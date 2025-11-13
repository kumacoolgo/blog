# 880913.xyz 克隆（原生 JS + Vercel Serverless + Upstash Redis + R2 上传）


- 登录：右上角，账号/密码在环境变量
- 资料编辑：名字/简介/头像/背景（支持上传至 R2，自动压缩、去 EXIF、WebP）
- 链接管理：图标（Emoji/URL/上传）、名称、URL、删除、保存
- 交互：登录后长按拖拽排序；底部添加链接


## 环境变量
见 `.env.example`，在 Vercel 项目中按相同键名添加。


## 本地开发
```bash
npm i
cp .env.example .env.local # 并填好实际值
vercel dev