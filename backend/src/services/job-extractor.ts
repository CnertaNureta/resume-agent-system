import { JobInfo } from '../types';

/**
 * 后端岗位信息提取服务
 * 作为浏览器端提取的补充，处理更复杂的提取逻辑
 */
export class JobExtractor {
  /**
   * 从文章文本中提取岗位信息
   * 用于浏览器端未能完全提取时的后备方案
   */
  extract(text: string, url: string): Partial<JobInfo> {
    const result: Partial<JobInfo> = {};

    // 深度邮箱提取 - 包括处理反爬混淆的情况
    const emailPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      /[a-zA-Z0-9._%+-]+\s*[@＠]\s*[a-zA-Z0-9.-]+\s*[.．]\s*[a-zA-Z]{2,}/g,
      /[a-zA-Z0-9._%+-]+(?:\[at\]|\(at\)|【at】)(?:[a-zA-Z0-9.-]+)(?:\[dot\]|\(dot\)|【dot】)(?:[a-zA-Z]{2,})/gi,
    ];

    for (const pattern of emailPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // 清理邮箱格式
        result.contactEmail = matches[0]
          .replace(/\s/g, '')
          .replace(/＠/g, '@')
          .replace(/．/g, '.')
          .replace(/\[at\]|\(at\)|【at】/gi, '@')
          .replace(/\[dot\]|\(dot\)|【dot】/gi, '.');
        break;
      }
    }

    // 提取多个岗位（如果文章包含多个职位）
    const jobBlocks = this.splitJobBlocks(text);
    if (jobBlocks.length > 0) {
      const firstJob = jobBlocks[0];
      if (firstJob.title) result.title = firstJob.title;
      if (firstJob.requirements.length > 0) result.requirements = firstJob.requirements;
      if (firstJob.responsibilities.length > 0) result.responsibilities = firstJob.responsibilities;
    }

    // 提取部门信息
    const deptMatch = text.match(/(?:部门|团队|事业部)[：:\s]*(.+?)(?:\n|$)/);
    if (deptMatch) result.department = deptMatch[1].trim();

    return result;
  }

  /**
   * 将多岗位文章拆分为独立的岗位块
   */
  private splitJobBlocks(text: string): Array<{
    title: string;
    requirements: string[];
    responsibilities: string[];
  }> {
    const blocks: Array<{ title: string; requirements: string[]; responsibilities: string[] }> = [];

    // 按岗位标题拆分
    const jobSplitPattern = /(?:(?:^|\n)(?:[\d.、]+\s*)?(?:【|[\[（(])?\s*(?:岗位|职位)?[：:\s]*)?(.+?)(?:(?:】|[\]）)])\s*)?(?=\n(?:岗位|任职|工作|职位))/gm;
    const titleMatches = text.matchAll(/(?:招聘|诚聘|岗位)\s*[：:\s]*(.+?)(?:\n|$)/g);

    for (const match of titleMatches) {
      const title = match[1].trim();
      const startIdx = match.index! + match[0].length;
      const nextMatch = text.indexOf('\n招聘', startIdx);
      const blockText = nextMatch > 0 ? text.substring(startIdx, nextMatch) : text.substring(startIdx, startIdx + 2000);

      const requirements = this.extractListItems(blockText, ['任职要求', '岗位要求', '要求']);
      const responsibilities = this.extractListItems(blockText, ['工作职责', '岗位职责', '职责']);

      blocks.push({ title, requirements, responsibilities });
    }

    return blocks;
  }

  /**
   * 提取列表项
   */
  private extractListItems(text: string, sectionKeywords: string[]): string[] {
    for (const keyword of sectionKeywords) {
      const pattern = new RegExp(`${keyword}[：:\\s]*\\n?([\\s\\S]*?)(?=\\n(?:[\\u4e00-\\u9fff]{2,4}[：:])|$)`);
      const match = text.match(pattern);
      if (match) {
        return match[1]
          .split(/\n/)
          .map(line => line.replace(/^[\d.、\-\s*]+/, '').trim())
          .filter(line => line.length > 2);
      }
    }
    return [];
  }
}
