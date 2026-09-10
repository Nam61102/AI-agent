document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusBadge = document.getElementById('wa-status-badge');
  const statusText = document.getElementById('wa-status-text');
  const btnConnectNav = document.getElementById('btn-connect-wa');
  const btnConnectText = document.getElementById('btn-connect-text');
  const btnReanalyze = document.getElementById('btn-reanalyze-chats');
  const intelligenceContainer = document.getElementById('intelligence-container');

  // Modal Elements
  const qrModalBackdrop = document.getElementById('qr-modal-backdrop');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnRetryConnect = document.getElementById('btn-retry-connect');
  const qrcodeBox = document.getElementById('qrcode-box');
  const errorMessage = document.getElementById('error-message');

  // Modal State Containers
  const stateConnecting = document.getElementById('modal-state-connecting');
  const stateQr = document.getElementById('modal-state-qr');
  const stateAuthenticating = document.getElementById('modal-state-authenticating');
  const stateConnected = document.getElementById('modal-state-connected');
  const stateError = document.getElementById('modal-state-error');

  let socket = null;
  let currentStatus = 'NOT_CONNECTED';
  let activeCategoryFilter = 'all';
  let intelligenceData = {
    needs_action: [],
    important_event: [],
    relationship_insight: [],
    ai_auto_reply: []
  };

  // Fetch Intelligence Items from API
  async function fetchIntelligence() {
    try {
      const res = await fetch('/api/ai/intelligence');
      const json = await res.json();
      if (json.success && json.categories) {
        intelligenceData = json.categories;
        updateBadgeCounts();
        renderIntelligenceList();
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch intelligence:', err);
    }
  }

  // Update Badge Counts on Category Tabs
  function updateBadgeCounts() {
    const needsActionCount = intelligenceData.needs_action?.length || 0;
    const importantEventCount = intelligenceData.important_event?.length || 0;
    const relationshipInsightCount = intelligenceData.relationship_insight?.length || 0;
    const aiAutoReplyCount = intelligenceData.ai_auto_reply?.length || 0;
    const totalCount = needsActionCount + importantEventCount + relationshipInsightCount + aiAutoReplyCount;

    const bAll = document.getElementById('badge-count-all');
    const bNeeds = document.getElementById('badge-count-needs_action');
    const bEvents = document.getElementById('badge-count-important_event');
    const bRel = document.getElementById('badge-count-relationship_insight');
    const bAuto = document.getElementById('badge-count-ai_auto_reply');

    if (bAll) bAll.textContent = totalCount;
    if (bNeeds) bNeeds.textContent = needsActionCount;
    if (bEvents) bEvents.textContent = importantEventCount;
    if (bRel) bRel.textContent = relationshipInsightCount;
    if (bAuto) bAuto.textContent = aiAutoReplyCount;
  }

  // Render Intelligence List based on active category filter
  function renderIntelligenceList() {
    if (!intelligenceContainer) return;

    let itemsToRender = [];
    if (activeCategoryFilter === 'all') {
      itemsToRender = [
        ...(intelligenceData.needs_action || []),
        ...(intelligenceData.important_event || []),
        ...(intelligenceData.relationship_insight || []),
        ...(intelligenceData.ai_auto_reply || [])
      ];
    } else {
      itemsToRender = intelligenceData[activeCategoryFilter] || [];
    }

    if (itemsToRender.length === 0) {
      intelligenceContainer.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">✨</div>
          <div class="empty-state-title">No items in this category</div>
          <p class="empty-state-sub">
            NRYN continuously monitors incoming WhatsApp messages in the background and filters out 90% of casual chatter.
          </p>
        </div>
      `;
      return;
    }

    intelligenceContainer.innerHTML = itemsToRender.map(item => {
      const contactName = item.contact?.name || 'WhatsApp Contact';
      const timeStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent';

      let catBadgeClass = 'cat-tag ' + item.category;
      let catLabel = '🔴 Needs Action';
      if (item.category === 'important_event') catLabel = '🟡 Important Event';
      else if (item.category === 'relationship_insight') catLabel = '🟢 Relationship Insight';
      else if (item.category === 'ai_auto_reply') catLabel = '🔵 AI Auto-Reply';

      const suggestedReplyText = item.suggestedReply?.text || '';

      return `
        <div class="intelligence-card" id="card-${item.id}">
          <div class="card-top-bar">
            <span class="${catBadgeClass}">${catLabel} • ${item.subtype || 'general'}</span>
            <span class="card-time">${timeStr}</span>
          </div>

          <div class="card-contact-row">
            <div class="contact-avatar-circle">${contactName.charAt(0).toUpperCase()}</div>
            <div class="contact-name-title">${contactName}</div>
          </div>

          <!-- WHAT MATTERS -->
          <div class="intel-section">
            <div class="intel-section-title">📌 What Matters</div>
            <div class="intel-what">${item.whatMatters || 'Important message detected'}</div>
          </div>

          <!-- WHY IT MATTERS -->
          <div class="intel-section">
            <div class="intel-section-title">💡 Why It Matters</div>
            <div class="intel-why">${item.whyItMatters || 'Requires context evaluation'}</div>
          </div>

          <!-- WHAT NRYN RECOMMENDS -->
          <div class="intel-section intel-recommendation">
            <div class="intel-section-title">🤖 What NRYN Recommends</div>
            <p>${item.recommendedAction || 'Review message and respond appropriately.'}</p>
          </div>

          <!-- AI SUGGESTED REPLY AREA -->
          ${suggestedReplyText ? `
            <div class="reply-box">
              <div class="reply-header">
                <span class="intel-section-title" style="color: #34d399; margin: 0;">💬 AI Suggested Reply</span>
              </div>
              <p class="reply-text" id="reply-text-${item.id}">"${suggestedReplyText}"</p>
            </div>
          ` : ''}

          <!-- CARD ACTIONS -->
          <div class="card-actions-bar">
            <span class="subtext">Msg: "${item.sourceMessage?.text || ''}"</span>
            <div style="display: flex; gap: 8px;">
              ${suggestedReplyText ? `
                <button class="btn btn-primary" onclick="sendSuggestedReply(${item.id}, '${item.contact?.jid}', '${encodeURIComponent(suggestedReplyText)}')">
                  ➤ Send Reply
                </button>
              ` : ''}
              <button class="btn btn-secondary" onclick="dismissItem(${item.id})">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Category Tab Click Handler
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      activeCategoryFilter = target.getAttribute('data-category');
      renderIntelligenceList();
    });
  });

  // Global Handlers for inline actions
  window.sendSuggestedReply = async function(id, chatJid, encodedText) {
    const replyText = decodeURIComponent(encodedText);
    if (!chatJid || !replyText) return;

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: chatJid, message: replyText })
      });
      const data = await res.json();
      if (data.success) {
        alert('Reply sent successfully ✓');
        dismissItem(id);
      } else {
        alert('Failed to send reply');
      }
    } catch (err) {
      alert('Error sending reply');
    }
  };

  window.dismissItem = async function(id) {
    try {
      await fetch(`/api/ai/actions/${id}/dismiss`, { method: 'PATCH' });
      fetchIntelligence();
    } catch (err) {
      console.error('Failed to dismiss action:', err);
    }
  };

  if (btnReanalyze) {
    btnReanalyze.addEventListener('click', async () => {
      btnReanalyze.textContent = '✨ Analyzing...';
      btnReanalyze.disabled = true;
      try {
        await fetch('/api/ai/analyze-active', { method: 'POST' });
        await fetchIntelligence();
      } catch (err) {
        console.error('Re-analyze failed:', err);
      } finally {
        btnReanalyze.textContent = '✨ Re-Analyze WhatsApp';
        btnReanalyze.disabled = false;
      }
    });
  }

  // Initialize Socket.IO connection
  function initSocket() {
    socket = io(window.location.origin);

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend server');
      socket.emit('whatsapp:request_status');
    });

    socket.on('whatsapp:status', (data) => {
      handleStatusChange(data.status);
    });

    socket.on('whatsapp:qr', (data) => {
      if (data && data.qr) {
        renderQRCode(data.qr);
        showModalState('qr');
      }
    });

    socket.on('whatsapp:connecting', () => handleStatusChange('CONNECTING'));
    socket.on('whatsapp:connected', () => {
      handleStatusChange('CONNECTED');
      fetchIntelligence();
    });

    socket.on('whatsapp:message', () => {
      setTimeout(fetchIntelligence, 1000);
    });

    socket.on('whatsapp:disconnected', () => handleStatusChange('DISCONNECTED'));
    socket.on('whatsapp:logged_out', () => handleStatusChange('LOGGED_OUT'));

    socket.on('whatsapp:error', (data) => {
      if (data && data.message) errorMessage.textContent = data.message;
      showModalState('error');
    });
  }

  function handleStatusChange(status) {
    currentStatus = status;
    if (statusBadge) statusBadge.className = 'status-badge';

    switch (status) {
      case 'CONNECTED':
        if (statusBadge) statusBadge.classList.add('connected');
        if (statusText) statusText.textContent = 'WhatsApp: Connected';
        if (btnConnectNav) btnConnectNav.classList.add('hidden');
        showModalState('connected');
        setTimeout(hideModal, 1500);
        break;
      case 'CONNECTING':
        if (statusBadge) statusBadge.classList.add('connecting');
        if (statusText) statusText.textContent = 'WhatsApp: Connecting...';
        if (btnConnectText) btnConnectText.textContent = 'Connecting...';
        break;
      case 'QR_READY':
        if (statusBadge) statusBadge.classList.add('connecting');
        if (statusText) statusText.textContent = 'WhatsApp: Scan QR';
        if (btnConnectText) btnConnectText.textContent = 'Scan QR';
        break;
      case 'AUTHENTICATING':
        if (statusBadge) statusBadge.classList.add('connecting');
        if (statusText) statusText.textContent = 'WhatsApp: Authenticating...';
        showModalState('authenticating');
        break;
      case 'ERROR':
        if (statusBadge) statusBadge.classList.add('not-connected');
        if (statusText) statusText.textContent = 'WhatsApp: Error';
        if (btnConnectNav) btnConnectNav.classList.remove('hidden');
        if (btnConnectText) btnConnectText.textContent = 'Connect WhatsApp';
        showModalState('error');
        break;
      default:
        if (statusBadge) statusBadge.classList.add('not-connected');
        if (statusText) statusText.textContent = 'WhatsApp: Not Connected';
        if (btnConnectNav) btnConnectNav.classList.remove('hidden');
        if (btnConnectText) btnConnectText.textContent = 'Connect WhatsApp';
        break;
    }
  }

  function renderQRCode(qrString) {
    if (!qrcodeBox) return;
    qrcodeBox.innerHTML = '';
    if (qrString.startsWith('data:image')) {
      const img = document.createElement('img');
      img.src = qrString;
      img.width = 240;
      img.height = 240;
      qrcodeBox.appendChild(img);
    } else if (typeof QRCode !== 'undefined') {
      new QRCode(qrcodeBox, { text: qrString, width: 240, height: 240 });
    } else {
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrString)}`;
      img.width = 240;
      img.height = 240;
      qrcodeBox.appendChild(img);
    }
  }

  function showModalState(stateName) {
    if (!stateConnecting) return;
    stateConnecting.classList.add('hidden');
    stateQr.classList.add('hidden');
    stateAuthenticating.classList.add('hidden');
    stateConnected.classList.add('hidden');
    stateError.classList.add('hidden');

    if (stateName === 'connecting') stateConnecting.classList.remove('hidden');
    else if (stateName === 'qr') stateQr.classList.remove('hidden');
    else if (stateName === 'authenticating') stateAuthenticating.classList.remove('hidden');
    else if (stateName === 'connected') stateConnected.classList.remove('hidden');
    else if (stateName === 'error') stateError.classList.remove('hidden');
  }

  function openModal() { if (qrModalBackdrop) qrModalBackdrop.classList.remove('hidden'); }
  function hideModal() { if (qrModalBackdrop) qrModalBackdrop.classList.add('hidden'); }

  async function triggerConnect() {
    openModal();
    showModalState('connecting');
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        if (errorMessage) errorMessage.textContent = data.error || 'Failed to start client';
        showModalState('error');
      }
    } catch (err) {
      if (errorMessage) errorMessage.textContent = 'Network error';
      showModalState('error');
    }
  }

  if (btnConnectNav) btnConnectNav.addEventListener('click', triggerConnect);
  if (btnRetryConnect) btnRetryConnect.addEventListener('click', triggerConnect);
  if (btnCloseModal) btnCloseModal.addEventListener('click', hideModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', hideModal);

  // Initial loads & polling
  initSocket();
  fetchIntelligence();
  setInterval(fetchIntelligence, 12000);
});
