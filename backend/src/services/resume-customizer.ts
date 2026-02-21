import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { JobInfo, ResumeData, CustomizedResume } from '../types';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ZhipuClient = {
  chat: {
    completions: {
      create: (params: Record<string, unknown>) => Promise<ChatCompletionResponse>;
    };
  };
};

/**
 * 简历定制服务
 * 使用智谱 GLM 大模型根据岗位要求智能优化简历
 */
export class ResumeCustomizer {
  private outputDir: string;
  private client: ZhipuClient | null = null;
  private aiUnavailableReason: string | null = null;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    if (process.env.ZHIPUAI_API_KEY) {
      this.client = this.createAiClient(process.env.ZHIPUAI_API_KEY);
    } else {
      this.aiUnavailableReason = '未配置 ZHIPUAI_API_KEY';
    }
  }

  private createAiClient(apiKey: string): ZhipuClient | null {
    try {
      // zhipuai 依赖可能在部分环境中缺失，此处做运行时兜底
      const sdk = require('zhipuai');
      const ClientCtor = sdk?.ZhipuAI || sdk?.default;
      if (!ClientCtor) {
        this.aiUnavailableReason = 'zhipuai SDK 已安装，但未找到可用的客户端构造函数';
        console.warn(`${this.aiUnavailableReason}，使用规则匹配模式`);
        return null;
      }
      return new ClientCtor({ apiKey }) as ZhipuClient;
    } catch (error) {
      this.aiUnavailableReason = `未安装或无法加载 zhipuai SDK: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(`${this.aiUnavailableReason}，使用规则匹配模式`);
      return null;
    }
  }

  /**
   * 根据岗位信息定制简历
   */
  async customize(resume: ResumeData, jobInfo: JobInfo): Promise<CustomizedResume> {
    const id = uuidv4();

    let customizedText: string;
    let coverLetter: string;
    let emailSubject: string;
    let emailBody: string;

    if (this.client) {
      // 使用 GLM 大模型生成
      const aiResult = await this.aiCustomize(resume, jobInfo);
      customizedText = aiResult.customizedResume;
      coverLetter = aiResult.coverLetter;
      emailSubject = aiResult.emailSubject;
      emailBody = aiResult.emailBody;
    } else {
      // 回退到规则匹配
      console.warn(`${this.aiUnavailableReason || 'AI 服务不可用'}，使用规则匹配模式`);
      customizedText = this.fallbackCustomize(resume, jobInfo);
      coverLetter = this.fallbackCoverLetter(resume, jobInfo);
      emailSubject = `求职申请 - ${jobInfo.title} - ${resume.parsedSections.name || '候选人'}`;
      emailBody = `${coverLetter}\n\n------\n本邮件通过「简历智投」系统发送\n文章来源: ${jobInfo.articleTitle}\n${jobInfo.articleUrl}`;
    }

    // 保存定制化简历文件
    const customizedFileName = this.sanitizeFileName(
      `${resume.parsedSections.name || 'resume'}_${jobInfo.company}_${jobInfo.title}.txt`,
    );
    const customizedFilePath = path.join(this.outputDir, `${id}_${customizedFileName}`);
    fs.writeFileSync(customizedFilePath, customizedText, 'utf-8');

    return {
      id,
      baseResumeId: resume.id,
      jobInfo,
      customizedText,
      customizedFileName,
      customizedFilePath,
      coverLetter,
      emailSubject,
      emailBody,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 调用 GLM 大模型进行智能定制
   */
  private async aiCustomize(resume: ResumeData, jobInfo: JobInfo): Promise<{
    customizedResume: string;
    coverLetter: string;
    emailSubject: string;
    emailBody: string;
  }> {
    const model = process.env.GLM_MODEL || 'glm-4-flash';
    const name = resume.parsedSections.name || '候选人';
    const salutation = jobInfo.contactName || 'HR';

    // 1. 生成定制化简历
    const resumeResponse = await this.client!.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一位资深的职业规划师和简历优化专家。请根据目标岗位要求，优化候选人的简历内容。要求：1）突出与岗位匹配的经验和技能；2）将最相关的内容前置；3）用专业但简洁的语言重写；4）保持真实，不捏造经历；5）输出纯文本格式的完整简历。',
        },
        {
          role: 'user',
          content: `## 目标岗位信息
岗位：${jobInfo.title}
公司：${jobInfo.company}
${jobInfo.location ? `地点：${jobInfo.location}` : ''}
${jobInfo.salary ? `薪资：${jobInfo.salary}` : ''}

任职要求：
${jobInfo.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

工作职责：
${jobInfo.responsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 候选人原始简历
${resume.rawText}

请根据以上岗位要求，优化这份简历。直接输出优化后的完整简历文本，不要加任何解释。`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });
    const customizedResume = resumeResponse.choices?.[0]?.message?.content || this.fallbackCustomize(resume, jobInfo);

    // 2. 生成求职信 + 邮件主题 + 邮件正文
    const emailResponse = await this.client!.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一位求职邮件撰写专家。请根据岗位信息和候选人简历，生成求职信、邮件主题和邮件正文。要求真诚、专业、简洁，突出候选人与岗位的匹配度。请严格按照指定的 JSON 格式输出。',
        },
        {
          role: 'user',
          content: `## 岗位信息
岗位：${jobInfo.title}
公司：${jobInfo.company}
联系人：${salutation}

任职要求：
${jobInfo.requirements.slice(0, 5).join('、')}

## 候选人信息
姓名：${name}
${resume.parsedSections.phone ? `电话：${resume.parsedSections.phone}` : ''}
${resume.parsedSections.email ? `邮箱：${resume.parsedSections.email}` : ''}
${resume.parsedSections.summary ? `简介：${resume.parsedSections.summary.substring(0, 200)}` : ''}

来源：微信公众号文章《${jobInfo.articleTitle}》

请生成以下内容，严格按此 JSON 格式输出（不要加 markdown 代码块标记）：
{"coverLetter": "求职信全文", "emailSubject": "邮件主题", "emailBody": "邮件正文（包含求职信，末尾注明来源）"}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const emailContent = emailResponse.choices?.[0]?.message?.content || '';

    // 解析 JSON 响应
    let coverLetter: string;
    let emailSubject: string;
    let emailBody: string;

    try {
      const cleaned = emailContent.replace(/```json\s*|```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      coverLetter = parsed.coverLetter || this.fallbackCoverLetter(resume, jobInfo);
      emailSubject = parsed.emailSubject || `求职申请 - ${jobInfo.title} - ${name}`;
      emailBody = parsed.emailBody || `${coverLetter}\n\n------\n本邮件通过「简历智投」系统发送\n文章来源: ${jobInfo.articleTitle}\n${jobInfo.articleUrl}`;
    } catch {
      // JSON 解析失败，使用 AI 原始输出作为求职信，其余回退
      coverLetter = emailContent || this.fallbackCoverLetter(resume, jobInfo);
      emailSubject = `求职申请 - ${jobInfo.title} - ${name}`;
      emailBody = `${coverLetter}\n\n------\n本邮件通过「简历智投」系统发送\n文章来源: ${jobInfo.articleTitle}\n${jobInfo.articleUrl}`;
    }

    return { customizedResume, coverLetter, emailSubject, emailBody };
  }

  /**
   * 清理文件名，避免非法字符导致写入失败
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 规则匹配回退 - 简历定制
   */
  private fallbackCustomize(resume: ResumeData, jobInfo: JobInfo): string {
    const sections = resume.parsedSections;
    const keywords = this.extractKeywords(jobInfo);
    let customized = '';

    customized += `${sections.name || '候选人'}\n`;
    if (sections.phone) customized += `电话: ${sections.phone}\n`;
    if (sections.email) customized += `邮箱: ${sections.email}\n`;
    customized += '\n';

    customized += `求职意向\n${'─'.repeat(40)}\n`;
    customized += `目标岗位: ${jobInfo.title}\n目标公司: ${jobInfo.company}\n`;
    if (jobInfo.location) customized += `工作地点: ${jobInfo.location}\n`;
    customized += '\n';

    if (sections.summary) {
      customized += `个人简介\n${'─'.repeat(40)}\n${sections.summary}\n\n`;
    }
    if (sections.experience) {
      const paragraphs = sections.experience.split(/\n\n+/);
      const sorted = paragraphs.sort((a, b) => {
        const scoreA = keywords.reduce((s, k) => s + (a.includes(k) ? 1 : 0), 0);
        const scoreB = keywords.reduce((s, k) => s + (b.includes(k) ? 1 : 0), 0);
        return scoreB - scoreA;
      });
      customized += `工作经验\n${'─'.repeat(40)}\n${sorted.join('\n\n')}\n\n`;
    }
    if (sections.projects) customized += `项目经验\n${'─'.repeat(40)}\n${sections.projects}\n\n`;
    if (sections.skills) {
      const skillList = sections.skills.split(/[,，、;\n]/g).map(s => s.trim()).filter(Boolean);
      const matched = skillList.filter(s => keywords.some(k => s.toLowerCase().includes(k.toLowerCase())));
      const unmatched = skillList.filter(s => !matched.includes(s));
      customized += `专业技能\n${'─'.repeat(40)}\n${[...matched, ...unmatched].join('、')}\n\n`;
    }
    if (sections.education) customized += `教育背景\n${'─'.repeat(40)}\n${sections.education}\n`;

    return customized;
  }

  /**
   * 规则匹配回退 - 求职信
   */
  private fallbackCoverLetter(resume: ResumeData, jobInfo: JobInfo): string {
    const name = resume.parsedSections.name || '候选人';
    const salutation = jobInfo.contactName || 'HR';
    return `尊敬的${salutation}，您好！

我在贵公司微信公众号文章中看到${jobInfo.title}的招聘信息，非常感兴趣，特此投递简历。

${resume.parsedSections.summary ? `个人简介：${resume.parsedSections.summary.substring(0, 150)}` : ''}

${jobInfo.requirements.length > 0 ? `我注意到该岗位要求包括${jobInfo.requirements.slice(0, 3).join('、')}等，我在相关领域有丰富的经验和积累。` : ''}

期待有机会与您进一步交流，感谢您的时间！

此致
敬礼

${name}
${resume.parsedSections.phone || ''}
${resume.parsedSections.email || ''}`;
  }

  private extractKeywords(jobInfo: JobInfo): string[] {
    const allText = [...jobInfo.requirements, ...jobInfo.responsibilities, jobInfo.title].join(' ');
    const words = allText.split(/[\s,，、;；。.!！?？()（）\[\]【】]/g).map(w => w.trim()).filter(w => w.length >= 2);
    return [...new Set(words)];
  }
}
