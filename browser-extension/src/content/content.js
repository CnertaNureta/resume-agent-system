/**
 * Content Script - 微信公众号文章岗位信息提取
 * 在微信文章页面中运行，提取招聘信息并注入操作面板
 */

const API_BASE = 'http://localhost:3000/api';

/** 从文章内容中提取岗位信息 */
function extractJobInfo() {
  const articleBody = document.getElementById('js_content') || document.querySelector('.rich_media_content');
  if (!articleBody) return null;

  const text = articleBody.innerText;
  const html = articleBody.innerHTML;
  const title = document.querySelector('.rich_media_title')?.innerText?.trim() || document.title;

  // 提取邮箱
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];

  // 提取岗位名称 - 常见模式
  const jobTitlePatterns = [
    /(?:招聘|诚聘|急招|热招)[：:\s]*(.+?)(?:\n|$)/g,
    /(?:岗位|职位)[名称]*[：:\s]*(.+?)(?:\n|$)/g,
    /【(.+?)】/g,
  ];
  let jobTitle = '';
  for (const pattern of jobTitlePatterns) {
    const match = pattern.exec(text);
    if (match) {
      jobTitle = match[1].trim();
      break;
    }
  }
  if (!jobTitle) jobTitle = title;

  // 提取公司名称
  const companyPatterns = [
    /(?:公司|企业|集团|机构)[名称]*[：:\s]*(.+?)(?:\n|$)/,
    /(?:关于|about)\s*(.+?)(?:\n|$)/i,
  ];
  let company = '';
  const accountName = document.getElementById('js_name')?.innerText?.trim();
  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match) {
      company = match[1].trim();
      break;
    }
  }
  if (!company) company = accountName || '未知公司';

  // 提取工作要求
  const requirementSection = extractSection(text, ['任职要求', '岗位要求', '职位要求', '要求', '条件', 'Requirements']);
  const requirements = requirementSection
    ? requirementSection.split(/\n|；|;/).map(r => r.replace(/^[\d.、\-\s]+/, '').trim()).filter(Boolean)
    : [];

  // 提取工作职责
  const responsibilitySection = extractSection(text, ['工作职责', '岗位职责', '职责', '工作内容', 'Responsibilities']);
  const responsibilities = responsibilitySection
    ? responsibilitySection.split(/\n|；|;/).map(r => r.replace(/^[\d.、\-\s]+/, '').trim()).filter(Boolean)
    : [];

  // 提取薪资
  const salaryPatterns = [
    /(?:薪[资酬]|待遇|月薪|年薪)[：:\s]*(.+?)(?:\n|$)/,
    /(\d+[kK]-\d+[kK])/,
    /(\d+万?\s*[-~]\s*\d+万?)/,
  ];
  let salary = '';
  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      salary = match[1].trim();
      break;
    }
  }

  // 提取工作地点
  const locationPatterns = [
    /(?:工作地[点址]|地[点址]|坐标)[：:\s]*(.+?)(?:\n|$)/,
    /(?:base|Base)[：:\s]*(.+?)(?:\n|$)/,
  ];
  let location = '';
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      location = match[1].trim();
      break;
    }
  }

  // 提取联系人
  const contactPatterns = [
    /(?:联系人|HR|hr|负责人)[：:\s]*(.+?)(?:\n|$)/,
  ];
  let contactName = '';
  for (const pattern of contactPatterns) {
    const match = text.match(pattern);
    if (match) {
      contactName = match[1].trim();
      break;
    }
  }

  return {
    title: jobTitle,
    company,
    department: '',
    location,
    requirements,
    responsibilities,
    salary,
    contactEmail: emails[0] || '',
    contactName,
    articleUrl: window.location.href,
    articleTitle: title,
    extractedAt: new Date().toISOString(),
  };
}

/** 提取文章中的特定段落 */
function extractSection(text, keywords) {
  for (const keyword of keywords) {
    const regex = new RegExp(`${keyword}[：:\\s]*\\n?([\\s\\S]*?)(?=\\n(?:${getSectionEndPatterns()})|$)`, 'i');
    const match = text.match(regex);
    if (match) return match[1].trim();
  }
  return '';
}

function getSectionEndPatterns() {
  return [
    '任职要求', '岗位要求', '职位要求', '工作职责', '岗位职责',
    '薪资', '待遇', '福利', '联系', '投递', '简历', '报名',
    '工作地', '公司介绍', '关于我们',
  ].join('|');
}

/** 注入悬浮操作面板 */
function injectPanel() {
  if (document.getElementById('resume-agent-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'resume-agent-panel';
  panel.innerHTML = `
    <div class="ra-panel">
      <div class="ra-header">
        <span class="ra-title">📋 简历智投</span>
        <button class="ra-toggle" id="ra-toggle">−</button>
      </div>
      <div class="ra-body" id="ra-body">
        <div class="ra-step" id="ra-step-extract">
          <div class="ra-step-header">
            <span class="ra-step-num">1</span>
            <span>提取岗位信息</span>
          </div>
          <button class="ra-btn ra-btn-primary" id="ra-extract-btn">🔍 提取岗位信息</button>
          <div class="ra-job-info" id="ra-job-info" style="display:none;"></div>
        </div>

        <div class="ra-step" id="ra-step-upload">
          <div class="ra-step-header">
            <span class="ra-step-num">2</span>
            <span>上传简历</span>
          </div>
          <div class="ra-upload-area" id="ra-upload-area">
            <input type="file" id="ra-file-input" accept=".pdf,.doc,.docx,.txt" style="display:none;">
            <p>📄 点击或拖拽上传简历</p>
            <p class="ra-hint">支持 PDF、Word、TXT 格式</p>
          </div>
          <div class="ra-resume-status" id="ra-resume-status" style="display:none;"></div>
        </div>

        <div class="ra-step" id="ra-step-customize">
          <div class="ra-step-header">
            <span class="ra-step-num">3</span>
            <span>AI 优化简历</span>
          </div>
          <button class="ra-btn ra-btn-primary" id="ra-customize-btn" disabled>🤖 开始智能优化</button>
          <div class="ra-customize-result" id="ra-customize-result" style="display:none;"></div>
        </div>

        <div class="ra-step" id="ra-step-review">
          <div class="ra-step-header">
            <span class="ra-step-num">4</span>
            <span>确认并发送</span>
          </div>
          <div class="ra-review-area" id="ra-review-area" style="display:none;">
            <div class="ra-email-preview" id="ra-email-preview"></div>
            <div class="ra-actions">
              <button class="ra-btn ra-btn-secondary" id="ra-edit-btn">✏️ 编辑</button>
              <button class="ra-btn ra-btn-warning" id="ra-skip-btn">⏭️ 跳过确认直接发送</button>
              <button class="ra-btn ra-btn-success" id="ra-send-btn">📧 确认发送</button>
            </div>
          </div>
        </div>

        <div class="ra-status-bar" id="ra-status-bar" style="display:none;">
          <div class="ra-progress"></div>
          <span class="ra-status-text" id="ra-status-text"></span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  bindPanelEvents();
}

/** 绑定面板事件 */
function bindPanelEvents() {
  let jobInfo = null;
  let resumeId = null;
  let customizedResumeId = null;

  // 折叠/展开
  document.getElementById('ra-toggle').addEventListener('click', () => {
    const body = document.getElementById('ra-body');
    const btn = document.getElementById('ra-toggle');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      btn.textContent = '−';
    } else {
      body.style.display = 'none';
      btn.textContent = '+';
    }
  });

  // 提取岗位信息
  document.getElementById('ra-extract-btn').addEventListener('click', async () => {
    setStatus('正在提取岗位信息...');
    jobInfo = extractJobInfo();
    if (!jobInfo) {
      setStatus('未能提取到岗位信息，请确认页面包含招聘内容', 'error');
      return;
    }

    // 如果没提取到邮箱，尝试通过后端AI提取
    if (!jobInfo.contactEmail) {
      try {
        const articleText = (document.getElementById('js_content') || document.querySelector('.rich_media_content'))?.innerText || '';
        const resp = await fetch(`${API_BASE}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: articleText, url: window.location.href }),
        });
        const result = await resp.json();
        if (result.success && result.data) {
          jobInfo = { ...jobInfo, ...result.data };
        }
      } catch (e) {
        console.warn('Backend extraction failed, using local results:', e);
      }
    }

    displayJobInfo(jobInfo);
    setStatus('岗位信息提取完成', 'success');
  });

  // 上传简历
  const uploadArea = document.getElementById('ra-upload-area');
  const fileInput = document.getElementById('ra-file-input');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('ra-dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('ra-dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('ra-dragover');
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
  });

  async function handleFileUpload(file) {
    setStatus('正在上传简历...');
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const resp = await fetch(`${API_BASE}/resume/upload`, {
        method: 'POST',
        body: formData,
      });
      const result = await resp.json();
      if (result.success) {
        resumeId = result.data.id;
        document.getElementById('ra-resume-status').style.display = 'block';
        document.getElementById('ra-resume-status').innerHTML = `
          <div class="ra-success">✅ 已上传: ${file.name}</div>
        `;
        document.getElementById('ra-customize-btn').disabled = !(jobInfo && resumeId);
        setStatus('简历上传成功', 'success');
      } else {
        setStatus(`上传失败: ${result.error}`, 'error');
      }
    } catch (e) {
      setStatus(`上传失败: ${e.message}`, 'error');
    }
  }

  // AI优化简历
  document.getElementById('ra-customize-btn').addEventListener('click', async () => {
    if (!jobInfo || !resumeId) return;
    setStatus('AI 正在根据岗位要求优化您的简历...');
    document.getElementById('ra-customize-btn').disabled = true;

    try {
      const resp = await fetch(`${API_BASE}/resume/customize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, jobInfo }),
      });
      const result = await resp.json();
      if (result.success) {
        customizedResumeId = result.data.id;
        showReviewArea(result.data);
        setStatus('简历优化完成，请确认后发送', 'success');
      } else {
        setStatus(`优化失败: ${result.error}`, 'error');
        document.getElementById('ra-customize-btn').disabled = false;
      }
    } catch (e) {
      setStatus(`优化失败: ${e.message}`, 'error');
      document.getElementById('ra-customize-btn').disabled = false;
    }
  });

  // 确认发送
  document.getElementById('ra-send-btn').addEventListener('click', () => sendResume(false));
  document.getElementById('ra-skip-btn').addEventListener('click', () => sendResume(true));

  // 编辑
  document.getElementById('ra-edit-btn').addEventListener('click', () => {
    const emailBody = document.getElementById('ra-email-body-edit');
    const emailSubject = document.getElementById('ra-email-subject-edit');
    if (emailBody) emailBody.readOnly = !emailBody.readOnly;
    if (emailSubject) emailSubject.readOnly = !emailSubject.readOnly;
  });

  async function sendResume(skipReview) {
    setStatus('正在发送简历...');
    try {
      const emailSubject = document.getElementById('ra-email-subject-edit')?.value;
      const emailBody = document.getElementById('ra-email-body-edit')?.value;

      const resp = await fetch(`${API_BASE}/resume/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customizedResumeId,
          skipReview,
          emailSubject,
          emailBody,
        }),
      });
      const result = await resp.json();
      if (result.success) {
        setStatus('🎉 简历发送成功！', 'success');
        document.getElementById('ra-review-area').innerHTML = `
          <div class="ra-success-big">
            <p>🎉 简历已成功发送至</p>
            <p><strong>${jobInfo.contactEmail}</strong></p>
            <p class="ra-hint">发送时间: ${new Date().toLocaleString()}</p>
          </div>
        `;
      } else {
        setStatus(`发送失败: ${result.error}`, 'error');
      }
    } catch (e) {
      setStatus(`发送失败: ${e.message}`, 'error');
    }
  }

  function displayJobInfo(info) {
    const container = document.getElementById('ra-job-info');
    container.style.display = 'block';
    container.innerHTML = `
      <div class="ra-info-card">
        <div class="ra-info-row"><label>岗位:</label><span>${info.title}</span></div>
        <div class="ra-info-row"><label>公司:</label><span>${info.company}</span></div>
        ${info.location ? `<div class="ra-info-row"><label>地点:</label><span>${info.location}</span></div>` : ''}
        ${info.salary ? `<div class="ra-info-row"><label>薪资:</label><span>${info.salary}</span></div>` : ''}
        <div class="ra-info-row"><label>邮箱:</label><span>${info.contactEmail || '<span class="ra-warning">未找到投递邮箱</span>'}</span></div>
        ${info.contactName ? `<div class="ra-info-row"><label>联系人:</label><span>${info.contactName}</span></div>` : ''}
        ${info.requirements.length > 0 ? `
          <div class="ra-info-section">
            <label>任职要求:</label>
            <ul>${info.requirements.map(r => `<li>${r}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    `;
    document.getElementById('ra-customize-btn').disabled = !(jobInfo && resumeId);
  }

  function showReviewArea(customized) {
    const area = document.getElementById('ra-review-area');
    area.style.display = 'block';
    document.getElementById('ra-email-preview').innerHTML = `
      <div class="ra-preview">
        <div class="ra-preview-field">
          <label>收件人:</label>
          <span>${jobInfo.contactEmail}</span>
        </div>
        <div class="ra-preview-field">
          <label>邮件主题:</label>
          <input type="text" id="ra-email-subject-edit" class="ra-input" value="${escapeHtml(customized.emailSubject)}" readonly>
        </div>
        <div class="ra-preview-field">
          <label>邮件正文:</label>
          <textarea id="ra-email-body-edit" class="ra-textarea" rows="8" readonly>${escapeHtml(customized.emailBody)}</textarea>
        </div>
        <div class="ra-preview-field">
          <label>求职信摘要:</label>
          <p class="ra-cover-letter">${escapeHtml(customized.coverLetter).substring(0, 200)}...</p>
        </div>
        <div class="ra-preview-field">
          <label>附件:</label>
          <span>📎 ${customized.customizedFileName}</span>
        </div>
      </div>
    `;
  }
}

function setStatus(message, type = 'info') {
  const bar = document.getElementById('ra-status-bar');
  const text = document.getElementById('ra-status-text');
  if (!bar || !text) return;
  bar.style.display = 'flex';
  bar.className = `ra-status-bar ra-status-${type}`;
  text.textContent = message;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPanel);
} else {
  injectPanel();
}
