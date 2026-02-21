import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { JobInfo, ResumeData, CustomizedResume } from '../types';

/**
 * 简历定制服务
 * 根据岗位要求智能优化简历内容
 */
export class ResumeCustomizer {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * 根据岗位信息定制简历
   */
  async customize(resume: ResumeData, jobInfo: JobInfo): Promise<CustomizedResume> {
    const id = uuidv4();

    // 生成定制化简历内容
    const customizedText = this.generateCustomizedResume(resume, jobInfo);

    // 生成求职信
    const coverLetter = this.generateCoverLetter(resume, jobInfo);

    // 生成邮件主题和正文
    const emailSubject = this.generateEmailSubject(resume, jobInfo);
    const emailBody = this.generateEmailBody(resume, jobInfo, coverLetter);

    // 保存定制化简历文件
    const customizedFileName = this.buildSafeFileName(resume, jobInfo);
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
   * 生成安全的文件名，避免非法路径字符导致写文件失败
   */
  private buildSafeFileName(resume: ResumeData, jobInfo: JobInfo): string {
    const rawName = `${resume.parsedSections.name || 'resume'}_${jobInfo.company}_${jobInfo.title}`;
    const sanitized = rawName
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120)
      .replace(/^_+|_+$/g, '');

    return `${sanitized || 'resume_customized'}.txt`;
  }

  /**
   * 生成定制化简历
   * 根据岗位要求重新组织和优化简历内容
   */
  private generateCustomizedResume(resume: ResumeData, jobInfo: JobInfo): string {
    const sections = resume.parsedSections;
    const keywords = this.extractKeywords(jobInfo);

    let customized = '';

    // 个人信息
    customized += `${sections.name || '候选人'}\n`;
    if (sections.phone) customized += `电话: ${sections.phone}\n`;
    if (sections.email) customized += `邮箱: ${sections.email}\n`;
    customized += '\n';

    // 求职意向 - 匹配岗位
    customized += `求职意向\n`;
    customized += `${'─'.repeat(40)}\n`;
    customized += `目标岗位: ${jobInfo.title}\n`;
    customized += `目标公司: ${jobInfo.company}\n`;
    if (jobInfo.location) customized += `工作地点: ${jobInfo.location}\n`;
    customized += '\n';

    // 个人摘要 - 突出匹配度
    if (sections.summary) {
      customized += `个人简介\n`;
      customized += `${'─'.repeat(40)}\n`;
      customized += this.enhanceSummary(sections.summary, keywords);
      customized += '\n\n';
    }

    // 工作经验 - 强调相关经验
    if (sections.experience) {
      customized += `工作经验\n`;
      customized += `${'─'.repeat(40)}\n`;
      customized += this.highlightRelevantExperience(sections.experience, keywords);
      customized += '\n\n';
    }

    // 项目经验
    if (sections.projects) {
      customized += `项目经验\n`;
      customized += `${'─'.repeat(40)}\n`;
      customized += sections.projects;
      customized += '\n\n';
    }

    // 技能 - 重新排序匹配的技能优先
    if (sections.skills) {
      customized += `专业技能\n`;
      customized += `${'─'.repeat(40)}\n`;
      customized += this.reorderSkills(sections.skills, keywords);
      customized += '\n\n';
    }

    // 教育背景
    if (sections.education) {
      customized += `教育背景\n`;
      customized += `${'─'.repeat(40)}\n`;
      customized += sections.education;
      customized += '\n';
    }

    return customized;
  }

  /**
   * 从岗位信息中提取关键词
   */
  private extractKeywords(jobInfo: JobInfo): string[] {
    const allText = [
      ...jobInfo.requirements,
      ...jobInfo.responsibilities,
      jobInfo.title,
    ].join(' ');

    // 提取中英文关键词
    const words = allText
      .split(/[\s,，、;；。.!！?？()（）\[\]【】]/g)
      .map(w => w.trim())
      .filter(w => w.length >= 2);

    return [...new Set(words)];
  }

  /**
   * 增强个人摘要，突出与岗位的匹配
   */
  private enhanceSummary(summary: string, keywords: string[]): string {
    let enhanced = summary;
    // 在摘要中标注匹配的关键能力
    const matchedKeywords = keywords.filter(k => summary.includes(k));
    if (matchedKeywords.length > 0) {
      enhanced += `\n核心匹配能力: ${matchedKeywords.join('、')}`;
    }
    return enhanced;
  }

  /**
   * 高亮相关工作经验
   */
  private highlightRelevantExperience(experience: string, keywords: string[]): string {
    // 简单的关键词匹配排序逻辑
    const paragraphs = experience.split(/\n\n+/);
    const scored = paragraphs.map(p => {
      const score = keywords.reduce((s, k) => s + (p.includes(k) ? 1 : 0), 0);
      return { text: p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.text).join('\n\n');
  }

  /**
   * 重新排序技能，匹配的优先
   */
  private reorderSkills(skills: string, keywords: string[]): string {
    const skillList = skills.split(/[,，、;\n]/g).map(s => s.trim()).filter(Boolean);
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const skill of skillList) {
      if (keywords.some(k => skill.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(skill.toLowerCase()))) {
        matched.push(skill);
      } else {
        unmatched.push(skill);
      }
    }

    return [...matched, ...unmatched].join('、');
  }

  /**
   * 生成求职信
   */
  private generateCoverLetter(resume: ResumeData, jobInfo: JobInfo): string {
    const name = resume.parsedSections.name || '候选人';
    const salutation = jobInfo.contactName ? `${jobInfo.contactName}` : 'HR';

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

  /**
   * 生成邮件主题
   */
  private generateEmailSubject(resume: ResumeData, jobInfo: JobInfo): string {
    const name = resume.parsedSections.name || '候选人';
    return `求职申请 - ${jobInfo.title} - ${name}`;
  }

  /**
   * 生成邮件正文
   */
  private generateEmailBody(resume: ResumeData, jobInfo: JobInfo, coverLetter: string): string {
    return `${coverLetter}

------
本邮件通过「简历智投」系统自动发送
文章来源: ${jobInfo.articleTitle}
${jobInfo.articleUrl}`;
  }
}
