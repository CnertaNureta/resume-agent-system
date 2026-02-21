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

/** Message types between extension and backend */
export type MessageType =
  | { type: 'EXTRACT_JOB_INFO'; payload: { url: string } }
  | { type: 'JOB_INFO_EXTRACTED'; payload: JobInfo }
  | { type: 'UPLOAD_RESUME'; payload: { file: string; fileName: string } }
  | { type: 'RESUME_UPLOADED'; payload: ResumeData }
  | { type: 'CUSTOMIZE_RESUME'; payload: { resumeId: string; jobInfo: JobInfo } }
  | { type: 'RESUME_CUSTOMIZED'; payload: CustomizedResume }
  | { type: 'APPROVE_SUBMISSION'; payload: { customizedResumeId: string } }
  | { type: 'SKIP_REVIEW'; payload: { customizedResumeId: string } }
  | { type: 'SUBMISSION_RESULT'; payload: SubmissionRecord };

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
