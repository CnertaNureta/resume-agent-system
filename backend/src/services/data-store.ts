import { ResumeData, CustomizedResume, SubmissionRecord } from '../types';

/**
 * 简单内存数据存储
 * 生产环境应替换为数据库
 */
export class DataStore {
  private resumes: Map<string, ResumeData> = new Map();
  private customizedResumes: Map<string, CustomizedResume> = new Map();
  private submissions: Map<string, SubmissionRecord> = new Map();

  // Resume operations
  saveResume(resume: ResumeData): void {
    this.resumes.set(resume.id, resume);
  }

  getResume(id: string): ResumeData | undefined {
    return this.resumes.get(id);
  }

  getAllResumes(): ResumeData[] {
    return Array.from(this.resumes.values());
  }

  // Customized resume operations
  saveCustomizedResume(customized: CustomizedResume): void {
    this.customizedResumes.set(customized.id, customized);
  }

  getCustomizedResume(id: string): CustomizedResume | undefined {
    return this.customizedResumes.get(id);
  }

  updateCustomizedResumeStatus(id: string, status: CustomizedResume['status']): void {
    const resume = this.customizedResumes.get(id);
    if (resume) {
      resume.status = status;
      if (status === 'sent') resume.sentAt = new Date().toISOString();
    }
  }

  // Submission operations
  saveSubmission(record: SubmissionRecord): void {
    this.submissions.set(record.id, record);
  }

  getSubmission(id: string): SubmissionRecord | undefined {
    return this.submissions.get(id);
  }

  getAllSubmissions(): SubmissionRecord[] {
    return Array.from(this.submissions.values());
  }

  // Stats
  getStats(): { todayCount: number; totalCount: number; resumeCount: number } {
    const today = new Date().toISOString().split('T')[0];
    const allSubs = this.getAllSubmissions();
    return {
      todayCount: allSubs.filter(s => s.createdAt.startsWith(today) && s.status === 'sent').length,
      totalCount: allSubs.filter(s => s.status === 'sent').length,
      resumeCount: this.resumes.size,
    };
  }
}
