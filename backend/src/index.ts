import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

const WECHAT_ORIGIN = 'https://mp.weixin.qq.com';
const CHROME_EXTENSION_ORIGIN_RE = /^chrome-extension:\/\/[a-p]{32}$/;
const allowedExtensionIds = new Set(
  (process.env.CHROME_EXTENSION_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
);

// 确保必要目录存在
const uploadsDir = path.join(process.cwd(), 'uploads');
const customizedDir = path.join(process.cwd(), 'customized');
for (const dir of [uploadsDir, customizedDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 中间件
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 Origin 的请求（如 curl/健康检查）
    if (!origin) {
      callback(null, true);
      return;
    }

    if (origin === WECHAT_ORIGIN) {
      callback(null, true);
      return;
    }

    // 仅允许合法格式的 Chrome 扩展来源；若配置了白名单则进一步校验扩展 ID
    if (CHROME_EXTENSION_ORIGIN_RE.test(origin)) {
      if (allowedExtensionIds.size === 0) {
        callback(null, true);
        return;
      }

      const extensionId = origin.replace('chrome-extension://', '');
      callback(null, allowedExtensionIds.has(extensionId));
      return;
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use('/api', apiRouter);

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║          📋 简历智投 后端服务              ║
║──────────────────────────────────────────║
║  服务地址: http://localhost:${PORT}         ║
║  API 文档: http://localhost:${PORT}/api     ║
║──────────────────────────────────────────║
║  确保已设置以下环境变量:                    ║
║    SMTP_HOST  - 邮件服务器地址              ║
║    SMTP_PORT  - 邮件服务器端口              ║
║    SMTP_USER  - 邮箱账号                   ║
║    SMTP_PASS  - 邮箱密码/授权码             ║
║    CHROME_EXTENSION_IDS - 扩展ID白名单(可选) ║
╚══════════════════════════════════════════╝
  `);
});

export default app;
