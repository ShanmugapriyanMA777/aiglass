// VisionAssist Guardian Portal - Alerts & Emergency SOS Module

let audioContext = null;

document.addEventListener('DOMContentLoaded', () => {
  initAlertsSystem();
});

function initAlertsSystem() {
  const sosModal = document.getElementById('sos-alert-modal');
  const ackBtn = document.getElementById('sos-ack-btn');
  const resolveBtn = document.getElementById('sos-resolve-btn');

  if (ackBtn) {
    ackBtn.addEventListener('click', () => {
      stopAlertChime();
      if (sosModal) sosModal.style.display = 'none';
      updateAlertStatusInDB('ACKNOWLEDGED');
    });
  }

  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => {
      stopAlertChime();
      if (sosModal) sosModal.style.display = 'none';
      updateAlertStatusInDB('RESOLVED');
    });
  }

  // Subscribe to Realtime Emergency Alerts
  listenForRealtimeAlerts();
}

function triggerEmergencySOSAlert(alertData) {
  const sosModal = document.getElementById('sos-alert-modal');
  const sosName = document.getElementById('sos-user-name');
  const sosLocation = document.getElementById('sos-user-location');
  const sosTime = document.getElementById('sos-user-time');
  const sosMsg = document.getElementById('sos-user-msg');

  if (sosName) sosName.textContent = alertData.user_name || 'VisionAssist User';
  if (sosLocation) sosLocation.textContent = alertData.location || 'Agni College Campus, Main Road';
  if (sosTime) sosTime.textContent = alertData.time || new Date().toLocaleTimeString();
  if (sosMsg) sosMsg.textContent = alertData.message || '🚨 EMERGENCY SOS ACTIVATED BY USER';

  if (sosModal) sosModal.style.display = 'flex';

  playAlertChime();
}

function playAlertChime() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5);

    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.warn('Audio chime playback note:', e);
  }
}

function stopAlertChime() {
  if (audioContext && audioContext.state === 'running') {
    audioContext.suspend();
  }
}

function listenForRealtimeAlerts() {
  if (isDemoMode()) {
    // In Demo Mode, allow triggering simulated SOS via button if clicked
    const demoSosBtn = document.getElementById('trigger-demo-sos-btn');
    if (demoSosBtn) {
      demoSosBtn.addEventListener('click', () => {
        triggerEmergencySOSAlert({
          user_name: 'Rahul (Visually Impaired User)',
          location: 'OMR Main Road near Metro Station',
          time: new Date().toLocaleTimeString(),
          message: '🚨 EMERGENCY SOS ACTIVATED FROM SMART GLASSES BUTTON'
        });
      });
    }
    return;
  }

  const client = getSupabase();
  if (!client) return;

  client.channel('public:alerts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, payload => {
      const alert = payload.new;
      if (alert.severity === 'CRITICAL' || alert.alert_type === 'SOS') {
        triggerEmergencySOSAlert({
          user_name: 'VisionAssist User',
          location: `${alert.latitude?.toFixed(4) || ''}, ${alert.longitude?.toFixed(4) || ''}`,
          time: new Date(alert.created_at).toLocaleTimeString(),
          message: alert.message
        });
      }
    })
    .subscribe();
}

async function updateAlertStatusInDB(newStatus) {
  if (isDemoMode()) return;
  const client = getSupabase();
  if (!client) return;

  try {
    await client.from('alerts').update({ status: newStatus, resolved_at: new Date().toISOString() }).eq('status', 'UNRESOLVED');
  } catch (err) {
    console.error('Error updating alert status:', err);
  }
}
