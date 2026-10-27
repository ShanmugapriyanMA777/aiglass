// VisionAssist Guardian Portal - Activity & Logs Module

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('activity-page')) {
    initActivityLogs();
  }
});

function initActivityLogs() {
  renderActivityTimeline();
  initActivityFilters();
}

function renderActivityTimeline(filterType = 'ALL') {
  const timelineEl = document.getElementById('activity-timeline-container');
  if (!timelineEl) return;

  const activities = getMockOrRealActivities();
  const filtered = filterType === 'ALL' ? activities : activities.filter(a => a.type === filterType);

  timelineEl.innerHTML = filtered.map(item => `
    <div class="timeline-item">
      <div class="timeline-dot" style="background: ${getEventTypeColor(item.type)};"></div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="timeline-time">${item.time}</span>
        <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; background:${getEventTypeBg(item.type)}; color:${getEventTypeColor(item.type)};">${item.type}</span>
      </div>
      <div class="timeline-desc">${item.title}</div>
      <div style="font-size:12px; color:var(--slate-500); margin-top:4px;">${item.details}</div>
      <div style="font-size:10px; color:var(--slate-400); margin-top:4px;">📍 ${item.location}</div>
    </div>
  `).join('');
}

function initActivityFilters() {
  const filterBtns = document.querySelectorAll('.activity-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active', 'btn-primary'));
      filterBtns.forEach(b => b.classList.add('btn-outline'));
      
      e.target.classList.remove('btn-outline');
      e.target.classList.add('active', 'btn-primary');

      const filter = e.target.getAttribute('data-filter') || 'ALL';
      renderActivityTimeline(filter);
    });
  });
}

function getMockOrRealActivities() {
  return [
    { type: 'NAVIGATION', time: '04:20 PM', title: 'Walking Navigation Started', details: 'Destination: Home (Agni College -> Home)', location: 'College Gate' },
    { type: 'CURRENCY', time: '02:15 PM', title: 'Currency Recognized', details: 'Detected ₹500 Indian Rupee Note (Confidence: 98%)', location: 'Campus Store' },
    { type: 'OCR', time: '11:42 AM', title: 'Text Label Read', details: '"Apollo Pharmacy - Medical Supplies Open 24 Hours"', location: 'OMR Road' },
    { type: 'OBJECT', time: '10:32 AM', title: 'Vehicle Approach Warning', details: 'Car detected on right at 2.4m distance. Warning spoken.', location: 'Crosswalk' },
    { type: 'FACE', time: '09:15 AM', title: 'Known Contact Recognized', details: 'Authorized contact "Priya" recognized.', location: 'College Campus' },
    { type: 'SAFETY', time: '08:35 AM', title: 'Zebra Crossing Detected', details: 'Approaching crosswalk. Signal confirmed GREEN.', location: 'Traffic Junction' }
  ];
}

function getEventTypeColor(type) {
  switch (type) {
    case 'SAFETY': return '#b91c1c';
    case 'OBJECT': return '#d97706';
    case 'CURRENCY': return '#059669';
    case 'OCR': return '#2563eb';
    case 'NAVIGATION': return '#7c3aed';
    default: return '#475569';
  }
}

function getEventTypeBg(type) {
  switch (type) {
    case 'SAFETY': return '#fee2e2';
    case 'OBJECT': return '#fef3c7';
    case 'CURRENCY': return '#d1fae5';
    case 'OCR': return '#dbeafe';
    case 'NAVIGATION': return '#f3e8ff';
    default: return '#f1f5f9';
  }
}
