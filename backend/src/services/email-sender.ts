import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { EmailConfig, CustomizedResume, SubmissionRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 邮件发送服务
 * 负责发送定制化简历邮件
 */
export class EmailSender {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  /**
   * 发送定制化简历邮件
   */
  async send(customizedResume: CustomizedResume, emailSubject?: string, emailBody?: string): Promise<SubmissionRecord> {
    const record: SubmissionRecord = {
      id: uuidv4(),
      customizedResumeId: customizedResume.id,
      jobInfo: customizedResume.jobInfo,
      recipientEmail: customizedResume.jobInfo.contactEmail,
      emailSubject: emailSubject || customizedResume.emailSubject,
      status: 'sending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // 准备附件
      const attachments: nodemailer.SendMailOptions['attachments'] = [];
      if (customizedResume.customizedFilePath && fs.existsSync(customizedResume.customizedFilePath)) {
        attachments.push({
          filename: customizedResume.customizedFileName,
          path: customizedResume.customizedFilePath,
        });
      }

      // 发送邮件
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.config.fromName}" <${this.config.from}>`,
        to: customizedResume.jobInfo.contactEmail,
        subject: emailSubject || customizedResume.emailSubject,
        text: emailBody || customizedResume.emailBody,
        attachments,
      };

      await this.transporter.sendMail(mailOptions);

      record.status = 'sent';
      record.updatedAt = new Date().toISOString();
    } catch (error) {
      record.status = 'failed';
      record.error = error instanceof Error ? error.message : 'Unknown error';
      record.updatedAt = new Date().toISOString();
    }

    return record;
  }

  /**
   * 验证邮件配置
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
