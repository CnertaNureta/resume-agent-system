import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedWebOrigins = new Set(['https://mp.weixin.qq.com']);
const allowedExtensionIds = new Set(
  (process.env.CHROME_EXTENSION_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
);

function isAllowedOrigin(origin: string): boolean {
  if (allowedWebOrigins.has(origin)) {
    return true;
  }

  if (!origin.startsWith('chrome-extension://')) {
    return false;
  }

  const match = origin.match(/^chrome-extension:\/\/([a-z]{32})$/i);
  if (!match) {
    return false;
  }

  const extensionId = match[1];

  // 若配置了扩展ID白名单，则只允许白名单内扩展
  if (allowedExtensionIds.size > 0) {
    return allowedExtensionIds.has(extensionId);
  }

  // 未配置白名单时，仅在非生产环境放行，避免生产环境默认过宽
  return process.env.NODE_ENV !== 'production';
}

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

    callback(null, isAllowedOrigin(origin));
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
  if (process.env.NODE_ENV === 'production' && allowedExtensionIds.size === 0) {
    console.warn('⚠️  生产环境未配置 CHROME_EXTENSION_IDS，浏览器扩展将被 CORS 拒绝。');
  }

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
║    CHROME_EXTENSION_IDS - 扩展ID白名单(逗号分隔) ║
╚══════════════════════════════════════════╝
  `);
});

export default app;
