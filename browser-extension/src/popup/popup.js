/**
 * Popup Script - 扩展弹窗逻辑
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 检查服务器状态
  chrome.runtime.sendMessage({ type: 'CHECK_SERVER' }, (response) => {
    const statusCard = document.getElementById('server-status');
    if (response?.online) {
      statusCard.className = 'status-card status-online';
      statusCard.innerHTML = '<div class="status-dot"></div><span>后端服务已连接</span>';
      loadStats();
    } else {
      statusCard.className = 'status-card status-offline';
      statusCard.innerHTML = '<div class="status-dot"></div><span>后端服务未连接 - 请启动服务器</span>';
    }
  });

  // 加载设置
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    const settings = response?.settings || {};
    if (settings.autoExtract) {
      document.getElementById('toggle-auto-extract').classList.add('active');
    }
    if (settings.skipReview) {
      document.getElementById('toggle-skip-review').classList.add('active');
    }
  });

  // 绑定开关事件
  document.getElementById('toggle-auto-extract').addEventListener('click', function() {
    this.classList.toggle('active');
    saveSettings();
  });

  document.getElementById('toggle-skip-review').addEventListener('click', function() {
    this.classList.toggle('active');
    saveSettings();
  });
});

function saveSettings() {
  const settings = {
    autoExtract: document.getElementById('toggle-auto-extract').classList.contains('active'),
    skipReview: document.getElementById('toggle-skip-review').classList.contains('active'),
  };
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
}

async function loadStats() {
  try {
    const resp = await fetch('http://localhost:3000/api/stats');
    const result = await resp.json();
    if (result.success) {
      document.getElementById('today-count').textContent = result.data.todayCount || 0;
      document.getElementById('total-count').textContent = result.data.totalCount || 0;
      document.getElementById('resume-count').textContent = result.data.resumeCount || 0;
    }
  } catch (e) {
    // Stats not available
  }
}
