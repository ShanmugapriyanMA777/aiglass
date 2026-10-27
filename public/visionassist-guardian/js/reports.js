// VisionAssist Guardian Portal - Daily Reports & Exporter Module

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('reports-page')) {
    initReportsPage();
  }
});

function initReportsPage() {
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const printReportBtn = document.getElementById('print-report-btn');

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportGuardianReportCSV);
  }

  if (printReportBtn) {
    printReportBtn.addEventListener('click', () => {
      window.print();
    });
  }

  renderDailySummaryReport();
}

function renderDailySummaryReport() {
  const dateEl = document.getElementById('report-date-display');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Update summary metrics
  setElText('report-active-time', '6h 24m');
  setElText('report-distance', '5.8 km');
  setElText('report-nav-count', '4 sessions');
  setElText('report-objects-count', '247 items');
  setElText('report-alerts-count', '3 warnings');
  setElText('report-ocr-count', '6 reads');
  setElText('report-currency-count', '2 scans');
  setElText('report-sos-count', '0 events');
  setElText('report-battery-avg', '68%');
  setElText('report-uptime', '7h 10m');

  const summaryTextEl = document.getElementById('ai-generated-summary-text');
  if (summaryTextEl) {
    summaryTextEl.textContent = "Today the user completed four navigation sessions and traveled approximately 5.8 kilometers. Three safety warnings were generated, mainly due to nearby vehicles and obstacles during crosswalk navigation. No emergency SOS events occurred, and device connectivity remained stable at 98% uptime.";
  }
}

function exportGuardianReportCSV() {
  const reportData = [
    ["VISIONASSIST GUARDIAN DAILY REPORT"],
    ["Date", new Date().toLocaleDateString()],
    ["User", "Rahul (Visually Impaired User)"],
    ["Guardian", "Authorized Parent/Caregiver"],
    [""],
    ["METRIC", "VALUE"],
    ["Total Active Time", "6h 24m"],
    ["Distance Travelled", "5.8 km"],
    ["Navigation Sessions", "4"],
    ["Objects Detected", "247"],
    ["Safety Alerts", "3"],
    ["OCR Sessions", "6"],
    ["Currency Scans", "2"],
    ["Emergency SOS Events", "0"],
    ["Average Battery", "68%"],
    ["Device Uptime", "7h 10m"],
    [""],
    ["AI DAILY SUMMARY"],
    ["Summary", "Today the user completed 4 navigation sessions and traveled 5.8 km. Three safety warnings were generated due to nearby vehicles. No SOS events occurred."]
  ];

  let csvContent = "data:text/csv;charset=utf-8," + reportData.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `VisionAssist_Guardian_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setElText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
