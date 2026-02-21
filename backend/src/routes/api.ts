import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { ResumeParser } from '../services/resume-parser';
import { ResumeCustomizer } from '../services/resume-customizer';
import { EmailSender } from '../services/email-sender';
import { JobExtractor } from '../services/job-extractor';
import { DataStore } from '../services/data-store';
import { EmailConfig, ApiResponse, JobInfo } from '../types';

const router = Router();

// 文件上传配置
const uploadDir = path.join(process.cwd(), 'uploads');
const customizedDir = path.join(process.cwd(), 'customized');

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}`));
    }
  },
});

// 初始化服务
const dataStore = new DataStore();
const resumeParser = new ResumeParser();
const resumeCustomizer = new ResumeCustomizer(customizedDir);
const jobExtractor = new JobExtractor();

// 邮件发送器 - 从环境变量配置
function getEmailSender(): EmailSender {
  const config: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || '求职者',
  };
  return new EmailSender(config);
}

/** 健康检查 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

/** 获取统计数据 */
router.get('/stats', (_req: Request, res: Response) => {
  const stats = dataStore.getStats();
  res.json({ success: true, data: stats });
});

/** 上传简历 */
router.post('/resume/upload', upload.single('resume'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传简历文件' } as ApiResponse<null>);
      return;
    }

    const resume = await resumeParser.parse(req.file.path, req.file.originalname);
    dataStore.saveResume(resume);

    res.json({
      success: true,
      data: {
        id: resume.id,
        fileName: resume.fileName,
        parsedSections: resume.parsedSections,
        uploadedAt: resume.uploadedAt,
      },
    } as ApiResponse<typeof resume>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '简历解析失败',
    } as ApiResponse<null>);
  }
});

/** 获取所有已上传的简历 */
router.get('/resume/list', (_req: Request, res: Response) => {
  const resumes = dataStore.getAllResumes().map(r => ({
    id: r.id,
    fileName: r.fileName,
    parsedSections: r.parsedSections,
    uploadedAt: r.uploadedAt,
  }));
  res.json({ success: true, data: resumes });
});

/** 后端辅助提取岗位信息 */
router.post('/extract', (req: Request, res: Response) => {
  try {
    const { text, url } = req.body;
    if (!text) {
      res.status(400).json({ success: false, error: '请提供文章文本' } as ApiResponse<null>);
      return;
    }

    const jobInfo = jobExtractor.extract(text, url || '');
    res.json({ success: true, data: jobInfo });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '提取失败',
    } as ApiResponse<null>);
  }
});

/** AI优化简历 */
router.post('/resume/customize', async (req: Request, res: Response) => {
  try {
    const { resumeId, jobInfo } = req.body as { resumeId: string; jobInfo: JobInfo };

    if (!resumeId || !jobInfo) {
      res.status(400).json({ success: false, error: '缺少简历ID或岗位信息' } as ApiResponse<null>);
      return;
    }

    const resume = dataStore.getResume(resumeId);
    if (!resume) {
      res.status(404).json({ success: false, error: '未找到简历' } as ApiResponse<null>);
      return;
    }

    const customized = await resumeCustomizer.customize(resume, jobInfo);
    dataStore.saveCustomizedResume(customized);

    res.json({
      success: true,
      data: {
        id: customized.id,
        customizedFileName: customized.customizedFileName,
        coverLetter: customized.coverLetter,
        emailSubject: customized.emailSubject,
        emailBody: customized.emailBody,
        status: customized.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '简历优化失败',
    } as ApiResponse<null>);
  }
});

/** 发送简历邮件 */
router.post('/resume/send', async (req: Request, res: Response) => {
  try {
    const { customizedResumeId, skipReview, emailSubject, emailBody } = req.body;

    if (!customizedResumeId) {
      res.status(400).json({ success: false, error: '缺少定制简历ID' } as ApiResponse<null>);
      return;
    }

    const customized = dataStore.getCustomizedResume(customizedResumeId);
    if (!customized) {
      res.status(404).json({ success: false, error: '未找到定制简历' } as ApiResponse<null>);
      return;
    }

    if (!customized.jobInfo.contactEmail) {
      res.status(400).json({ success: false, error: '缺少投递邮箱地址' } as ApiResponse<null>);
      return;
    }

    // 检查邮件配置
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      res.status(500).json({
        success: false,
        error: '邮件服务未配置。请设置环境变量 SMTP_USER 和 SMTP_PASS',
      } as ApiResponse<null>);
      return;
    }

    if (!skipReview && customized.status === 'pending_review') {
      dataStore.updateCustomizedResumeStatus(customizedResumeId, 'approved');
    }

    const emailSender = getEmailSender();
    const record = await emailSender.send(customized, emailSubject, emailBody);
    dataStore.saveSubmission(record);

    if (record.status === 'sent') {
      dataStore.updateCustomizedResumeStatus(customizedResumeId, 'sent');
    } else {
      dataStore.updateCustomizedResumeStatus(customizedResumeId, 'failed');
    }

    res.json({ success: record.status === 'sent', data: record, error: record.error });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '发送失败',
    } as ApiResponse<null>);
  }
});

/** 获取投递历史 */
router.get('/submissions', (_req: Request, res: Response) => {
  const submissions = dataStore.getAllSubmissions();
  res.json({ success: true, data: submissions });
});

export default router;
