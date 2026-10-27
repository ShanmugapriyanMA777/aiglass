// VisionAssist Guardian Portal - Device Health & Privacy Settings Module

document.addEventListener('DOMContentLoaded', () => {
  initSettingsUI();
});

function initSettingsUI() {
  // Load privacy settings states
  const privacyCheckboxes = ['share-location', 'share-objects', 'share-navigation', 'share-ocr', 'share-currency', 'share-ai'];
  privacyCheckboxes.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const saved = localStorage.getItem(`vg_${id}`);
      el.checked = saved === null ? true : saved === 'true';
      el.addEventListener('change', (e) => {
        localStorage.setItem(`vg_${id}`, e.target.checked);
      });
    }
  });

  // Device Status Health checks
  updateDeviceHealthDisplay();
}

function updateDeviceHealthDisplay() {
  const cameraEl = document.getElementById('setting-camera-status');
  const micEl = document.getElementById('setting-mic-status');
  const gpsEl = document.getElementById('setting-gps-status');
  const aiEl = document.getElementById('setting-ai-status');

  if (cameraEl) cameraEl.textContent = 'Active (1080p @ 30 FPS)';
  if (micEl) micEl.textContent = 'Active (Noise Cancelling)';
  if (gpsEl) gpsEl.textContent = 'Active (High Accuracy)';
  if (aiEl) aiEl.textContent = 'Active (Neural Vision + PyTorch Currency + YOLOv8)';
}
