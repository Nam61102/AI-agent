document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusBadge = document.getElementById('wa-status-badge');
  const statusText = document.getElementById('wa-status-text');
  const btnConnectNav = document.getElementById('btn-connect-wa');
  const btnConnectText = document.getElementById('btn-connect-text');
  
  const metricConnStatus = document.getElementById('metric-conn-status');
  const btnActionPrimary = document.getElementById('btn-action-primary');
  const btnActionDisconnect = document.getElementById('btn-action-disconnect');

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
  let qrCodeInstance = null;

  // Initialize Socket.IO connection
  function initSocket() {
    socket = io(window.location.origin);

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend server');
      socket.emit('whatsapp:request_status');
    });

    socket.on('whatsapp:status', (data) => {
      console.log('[Socket.IO] whatsapp:status', data);
      handleStatusChange(data.status);
    });

    socket.on('whatsapp:qr', (data) => {
      console.log('[Socket.IO] whatsapp:qr received');
      if (data && data.qr) {
        renderQRCode(data.qr);
        showModalState('qr');
      }
    });

    socket.on('whatsapp:connecting', () => {
      handleStatusChange('CONNECTING');
    });

    socket.on('whatsapp:connected', () => {
      handleStatusChange('CONNECTED');
    });

    socket.on('whatsapp:disconnected', () => {
      handleStatusChange('DISCONNECTED');
    });

    socket.on('whatsapp:logged_out', () => {
      handleStatusChange('LOGGED_OUT');
    });

    socket.on('whatsapp:error', (data) => {
      console.error('[Socket.IO] whatsapp:error', data);
      if (data && data.message) {
        errorMessage.textContent = data.message;
      }
      showModalState('error');
    });
  }

  // Update UI based on connection status
  function handleStatusChange(status) {
    currentStatus = status;

    // Reset badge classes
    statusBadge.className = 'status-badge';

    switch (status) {
      case 'CONNECTED':
        statusBadge.classList.add('connected');
        statusText.textContent = 'WhatsApp: Connected';
        metricConnStatus.textContent = 'Connected';
        metricConnStatus.className = 'metric-value green';
        
        btnConnectNav.classList.add('hidden');
        btnActionPrimary.classList.add('hidden');
        btnActionDisconnect.classList.remove('hidden');

        showModalState('connected');
        // Auto-close modal after success
        setTimeout(() => {
          hideModal();
        }, 1500);
        break;

      case 'CONNECTING':
        statusBadge.classList.add('connecting');
        statusText.textContent = 'WhatsApp: Connecting...';
        metricConnStatus.textContent = 'Connecting...';
        metricConnStatus.className = 'metric-value';
        
        btnConnectText.textContent = 'Connecting...';
        break;

      case 'QR_READY':
        statusBadge.classList.add('connecting');
        statusText.textContent = 'WhatsApp: Scan QR';
        metricConnStatus.textContent = 'Scan QR Code';
        metricConnStatus.className = 'metric-value';

        btnConnectText.textContent = 'Scan QR';
        break;

      case 'AUTHENTICATING':
        statusBadge.classList.add('connecting');
        statusText.textContent = 'WhatsApp: Authenticating...';
        metricConnStatus.textContent = 'Authenticating...';
        
        showModalState('authenticating');
        break;

      case 'ERROR':
        statusBadge.classList.add('not-connected');
        statusText.textContent = 'WhatsApp: Error';
        metricConnStatus.textContent = 'Error';
        metricConnStatus.className = 'metric-value red';

        btnConnectNav.classList.remove('hidden');
        btnConnectText.textContent = 'Connect WhatsApp';
        btnActionPrimary.classList.remove('hidden');
        btnActionDisconnect.classList.add('hidden');

        showModalState('error');
        break;

      case 'LOGGED_OUT':
      case 'DISCONNECTED':
      case 'NOT_CONNECTED':
      default:
        statusBadge.classList.add('not-connected');
        statusText.textContent = 'WhatsApp: Not Connected';
        metricConnStatus.textContent = 'Disconnected';
        metricConnStatus.className = 'metric-value';

        btnConnectNav.classList.remove('hidden');
        btnConnectText.textContent = 'Connect WhatsApp';
        btnActionPrimary.classList.remove('hidden');
        btnActionDisconnect.classList.add('hidden');
        break;
    }
  }

  // Render QR Code in modal
  function renderQRCode(qrString) {
    qrcodeBox.innerHTML = '';
    
    if (qrString.startsWith('data:image')) {
      const img = document.createElement('img');
      img.src = qrString;
      img.alt = 'WhatsApp QR Code';
      img.width = 240;
      img.height = 240;
      qrcodeBox.appendChild(img);
    } else if (typeof QRCode !== 'undefined') {
      qrCodeInstance = new QRCode(qrcodeBox, {
        text: qrString,
        width: 240,
        height: 240,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrString)}`;
      img.alt = 'WhatsApp QR Code';
      img.width = 240;
      img.height = 240;
      qrcodeBox.appendChild(img);
    }
  }

  // Manage modal display states (States 1 - 5)
  function showModalState(stateName) {
    stateConnecting.classList.add('hidden');
    stateQr.classList.add('hidden');
    stateAuthenticating.classList.add('hidden');
    stateConnected.classList.add('hidden');
    stateError.classList.add('hidden');

    switch (stateName) {
      case 'connecting':
        stateConnecting.classList.remove('hidden');
        break;
      case 'qr':
        stateQr.classList.remove('hidden');
        break;
      case 'authenticating':
        stateAuthenticating.classList.remove('hidden');
        break;
      case 'connected':
        stateConnected.classList.remove('hidden');
        break;
      case 'error':
        stateError.classList.remove('hidden');
        break;
    }
  }

  function openModal() {
    qrModalBackdrop.classList.remove('hidden');
  }

  function hideModal() {
    qrModalBackdrop.classList.add('hidden');
  }

  // Action Handlers
  async function triggerConnect() {
    openModal();
    showModalState('connecting');

    try {
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      console.log('/api/whatsapp/connect response:', data);

      if (!data.success) {
        errorMessage.textContent = data.error || 'Failed to start WhatsApp client';
        showModalState('error');
      }
    } catch (err) {
      console.error('Connect API call failed:', err);
      errorMessage.textContent = 'Network error connecting to backend API';
      showModalState('error');
    }
  }

  async function triggerDisconnect() {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;

    try {
      const response = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      console.log('/api/whatsapp/disconnect response:', data);
    } catch (err) {
      console.error('Disconnect API call failed:', err);
    }
  }

  // Event Listeners
  btnConnectNav.addEventListener('click', triggerConnect);
  btnActionPrimary.addEventListener('click', triggerConnect);
  btnActionDisconnect.addEventListener('click', triggerDisconnect);
  btnRetryConnect.addEventListener('click', triggerConnect);

  btnCloseModal.addEventListener('click', hideModal);
  btnCancelModal.addEventListener('click', hideModal);

  qrModalBackdrop.addEventListener('click', (e) => {
    if (e.target === qrModalBackdrop) {
      hideModal();
    }
  });

  // Start Socket.IO
  initSocket();
});
