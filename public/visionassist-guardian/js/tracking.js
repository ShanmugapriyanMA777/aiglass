// VisionAssist Guardian Portal - Live Tracking & Map Module

let trackingMap = null;
let userMarker = null;
let accuracyCircle = null;
let pathPolyline = null;
let pathCoordinates = [];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('map-element')) {
    initTrackingMap();
  }
});

function initTrackingMap() {
  const mapEl = document.getElementById('map-element');
  if (!mapEl) return;

  const initialLat = 12.9716;
  const initialLng = 80.2454;

  if (window.L) {
    trackingMap = L.map('map-element').setView([initialLat, initialLng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | VisionAssist Guardian'
    }).addTo(trackingMap);

    // Custom pulse marker icon for visually impaired user location
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="width:24px; height:24px; background:#2563eb; border:3px solid white; border-radius:50%; box-shadow:0 0 12px rgba(37,99,235,0.6); position:relative;">
          <div style="position:absolute; width:40px; height:40px; background:rgba(37,99,235,0.25); border-radius:50%; top:-11px; left:-11px; animation:pulse 1.5s infinite;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    userMarker = L.marker([initialLat, initialLng], { icon: userIcon }).addTo(trackingMap);
    userMarker.bindPopup("<b>VisionAssist User</b><br>Trusted GPS Active").openPopup();

    // Leaflet Dynamic Accuracy Circle
    accuracyCircle = L.circle([initialLat, initialLng], {
      radius: 10,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      weight: 1.5
    }).addTo(trackingMap);

    pathPolyline = L.polyline([], { color: '#2563eb', weight: 4, opacity: 0.7, dashArray: '5, 10' }).addTo(trackingMap);
  }

  // Start live location updates stream
  startLiveLocationStream();
}

function updateMapLocation(lat, lng, address = '', heading = 0, accuracy = 10) {
  if (!trackingMap || !userMarker) return;

  const newLatLng = [lat, lng];
  userMarker.setLatLng(newLatLng);
  trackingMap.panTo(newLatLng);

  if (accuracyCircle) {
    accuracyCircle.setLatLng(newLatLng);
    accuracyCircle.setRadius(accuracy || 10);
  }

  pathCoordinates.push(newLatLng);
  if (pathPolyline) pathPolyline.setLatLngs(pathCoordinates);

  const confidenceBadge = accuracy <= 15 ? '🟢 HIGH' : accuracy <= 45 ? '🟡 MEDIUM' : '🔴 LOW';

  if (address) {
    userMarker.setPopupContent(`
      <b>VisionAssist User</b><br>
      ${address}<br>
      <small>Accuracy: ±${accuracy}m (${confidenceBadge})</small><br>
      <small style="color:#64748b;">Updated: Just now</small>
    `);
  }
}

function startLiveLocationStream() {
  // 1. Read live synced state from VisionAssist Glasses
  const checkLiveSync = () => {
    try {
      const liveRaw = localStorage.getItem('va_guardian_live_state');
      if (liveRaw) {
        const state = JSON.parse(liveRaw);
        if (state.location?.latitude && state.location?.longitude) {
          updateMapLocation(
            state.location.latitude,
            state.location.longitude,
            state.location.address || 'Live Glasses Location',
            state.location.heading || 0,
            state.location.accuracy || 5
          );
          return true;
        }
      }
    } catch {}
    return false;
  };

  const hasLive = checkLiveSync();
  setInterval(checkLiveSync, 2500);

  try {
    const bc = new BroadcastChannel('visionassist_guardian_sync_bus');
    bc.onmessage = (e) => {
      if (e.data?.location?.latitude) {
        updateMapLocation(
          e.data.location.latitude,
          e.data.location.longitude,
          e.data.location.address || 'Live Glasses Location',
          e.data.location.heading || 0,
          e.data.location.accuracy || 5
        );
      }
    };
  } catch {}

  if (hasLive) return;

  if (isDemoMode()) {
    let step = 0;
    const simulatedPath = [
      { lat: 12.9716, lng: 80.2454, acc: 6 },
      { lat: 12.9719, lng: 80.2458, acc: 8 },
      { lat: 12.9723, lng: 80.2462, acc: 10 },
      { lat: 12.9727, lng: 80.2465, acc: 7 },
      { lat: 12.9730, lng: 80.2468, acc: 5 },
      { lat: 12.9734, lng: 80.2472, acc: 9 },
      { lat: 12.9738, lng: 80.2475, acc: 8 }
    ];

    setInterval(() => {
      const point = simulatedPath[step % simulatedPath.length];
      updateMapLocation(point.lat, point.lng, `Walking towards Apollo Hospital (Step ${step + 1})`, 45, point.acc);
      step++;
    }, 4000);

    return;
  }

  // Subscribe to Supabase Realtime 'locations' table
  const client = getSupabase();
  if (!client) return;

  client.channel('public:locations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, payload => {
      const { latitude, longitude, address, heading, accuracy } = payload.new;
      updateMapLocation(latitude, longitude, address, heading, accuracy);
    })
    .subscribe();
}
