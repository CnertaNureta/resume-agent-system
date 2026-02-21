import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

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

    const allowList = [
      'https://mp.weixin.qq.com',
    ];

    if (allowList.includes(origin) || origin.startsWith('chrome-extension://')) {
      callback(null, true);
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
╚══════════════════════════════════════════╝
  `);
});

export default app;
