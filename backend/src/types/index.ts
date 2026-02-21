/** Extracted job information from a WeChat article */
export interface JobInfo {
  title: string;
  company: string;
  department?: string;
  location?: string;
  requirements: string[];
  responsibilities: string[];
  salary?: string;
  contactEmail: string;
  contactName?: string;
  articleUrl: string;
  articleTitle: string;
  extractedAt: string;
}

/** User's base resume data */
export interface ResumeData {
  id: string;
  fileName: string;
  rawText: string;
  filePath: string;
  parsedSections: {
    name: string;
    phone?: string;
    email?: string;
    education?: string;
    experience?: string;
    skills?: string;
    projects?: string;
    summary?: string;
    [key: string]: string | undefined;
  };
  uploadedAt: string;
}

/** Customized resume for a specific job */
export interface CustomizedResume {
  id: string;
  baseResumeId: string;
  jobInfo: JobInfo;
  customizedText: string;
  customizedFileName: string;
  customizedFilePath: string;
  coverLetter: string;
  emailSubject: string;
  emailBody: string;
  status: 'draft' | 'pending_review' | 'approved' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
}

/** Submission record */
export interface SubmissionRecord {
  id: string;
  customizedResumeId: string;
  jobInfo: JobInfo;
  recipientEmail: string;
  emailSubject: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Email configuration */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  fromName: string;
}
