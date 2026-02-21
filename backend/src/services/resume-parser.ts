import * as fs from 'fs';
import * as path from 'path';
import { ResumeData } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 简历解析服务
 * 解析上传的简历文件，提取结构化信息
 */
export class ResumeParser {
  /**
   * 解析简历文件
   */
  async parse(filePath: string, fileName: string): Promise<ResumeData> {
    const ext = path.extname(fileName).toLowerCase();
    let rawText = '';

    if (ext === '.txt') {
      rawText = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.pdf') {
      rawText = await this.parsePdf(filePath);
    } else if (ext === '.doc' || ext === '.docx') {
      // For doc/docx, read as text fallback (in production, use mammoth or similar)
      rawText = await this.parseDocFallback(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }

    const parsedSections = this.extractSections(rawText);

    return {
      id: uuidv4(),
      fileName,
      rawText,
      filePath,
      parsedSections,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * 解析PDF文件
   */
  private async parsePdf(filePath: string): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (e) {
      console.warn('PDF parsing failed, returning empty text:', e);
      return '';
    }
  }

  /**
   * Doc/Docx 简单解析回退
   */
  private async parseDocFallback(filePath: string): Promise<string> {
    try {
      // Read raw bytes and extract text content as best effort
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r\t]/g, ' ');
      return text.replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  }

  /**
   * 从简历文本中提取各个段落
   */
  private extractSections(text: string): ResumeData['parsedSections'] {
    const sections: ResumeData['parsedSections'] = { name: '' };

    // 提取姓名 (通常在简历开头)
    const nameMatch = text.match(/^[\s]*([^\n\r,，。.]{2,5})[\s]*$/m);
    if (nameMatch) sections.name = nameMatch[1].trim();

    // 提取手机号
    const phoneMatch = text.match(/1[3-9]\d{9}/);
    if (phoneMatch) sections.phone = phoneMatch[0];

    // 提取邮箱
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) sections.email = emailMatch[0];

    // 提取各段落
    const sectionPatterns: Array<{ key: string; patterns: RegExp[] }> = [
      {
        key: 'education',
        patterns: [/(?:教育(?:背景|经历)?|学历)[：:\s\n]*([\s\S]*?)(?=(?:工作|项目|技能|自我|个人|专业|$))/i],
      },
      {
        key: 'experience',
        patterns: [/(?:工作(?:经[历验]|背景)?|实习经[历验])[：:\s\n]*([\s\S]*?)(?=(?:教育|项目|技能|自我|个人|$))/i],
      },
      {
        key: 'skills',
        patterns: [/(?:(?:专业|个人)?技能|技术栈)[：:\s\n]*([\s\S]*?)(?=(?:教育|工作|项目|自我|个人|$))/i],
      },
      {
        key: 'projects',
        patterns: [/(?:项目(?:经[历验])?)[：:\s\n]*([\s\S]*?)(?=(?:教育|工作|技能|自我|个人|$))/i],
      },
      {
        key: 'summary',
        patterns: [/(?:自我评价|个人[简总]介|自我介绍|Summary)[：:\s\n]*([\s\S]*?)(?=(?:教育|工作|项目|技能|$))/i],
      },
    ];

    for (const { key, patterns } of sectionPatterns) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          sections[key] = match[1].trim();
          break;
        }
      }
    }

    return sections;
  }
}
