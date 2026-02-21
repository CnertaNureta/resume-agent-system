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
const allowedOrigins = [
  /^chrome-extension:\/\/[a-p]{32}$/,
  'https://mp.weixin.qq.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // 允许同源请求或无 Origin 的工具请求（例如健康检查）
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowed = allowedOrigins.some(allowed => (
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    ));

    if (isAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use('/api', apiRouter);

// 根路径引导页
app.get('/', (_req, res) => {
  res.send(`
    <html>
    <head><meta charset="UTF-8"><title>简历智投</title>
    <style>
      body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 80px auto; color: #333; }
      h1 { color: #667eea; } code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
      .ok { color: #38a169; font-weight: bold; }
      ol { line-height: 2; }
    </style>
    </head>
    <body>
      <h1>📋 简历智投 后端服务</h1>
      <p class="ok">✅ 服务运行正常</p>
      <p>这是后端 API 服务，不提供网页界面。请按以下方式使用：</p>
      <ol>
        <li>安装 Chrome 扩展（加载 <code>browser-extension</code> 目录）</li>
        <li>打开任意微信公众号招聘文章</li>
        <li>使用页面右侧的「简历智投」面板操作</li>
      </ol>
      <p>API 健康检查：<a href="/api/health">/api/health</a></p>
    </body>
    </html>
  `);
});

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
