import { FileText, Download } from 'lucide-react';
import type { GuardianLiveState } from '../../lib/guardianRealtimeSync';

interface GuardianReportsProps {
  liveState: GuardianLiveState;
}

export default function GuardianReports({ liveState }: GuardianReportsProps) {
  const { stats, device, location } = liveState;

  const handleExportCSV = () => {
    const today = new Date().toISOString().split('T')[0];
    const headers = "Date,User,ObjectsDetected,SafetyAlerts,TripsCompleted,MobilityDistanceKm,CurrentBattery,LastKnownLocation\n";
    const row = `${today},"${device.userName}",${stats.objectsDetected},${stats.safetyAlertsCount},${stats.tripsCompleted},${stats.distanceWalkedKm},${device.battery}%,"${location.address}"\n`;
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + row);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `visionassist_guardian_report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Daily Safety & AI Usage Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">Exportable telemetry logs, risk metrics, and daily usage statistics</p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export Real-Time CSV Report
        </button>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">OBJECTS DETECTED</div>
          <div className="text-2xl font-black text-slate-900">{stats.objectsDetected}</div>
          <div className="text-[10px] font-semibold text-emerald-600">Continuous AI scanning</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">SAFETY ALERTS</div>
          <div className="text-2xl font-black text-amber-600">{stats.safetyAlertsCount}</div>
          <div className="text-[10px] font-semibold text-slate-500">Live safety monitoring</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">DISTANCE WALKED</div>
          <div className="text-2xl font-black text-slate-900">{stats.distanceWalkedKm} km</div>
          <div className="text-[10px] font-semibold text-emerald-600">Active mobility telemetry</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">COMPLETED TRIPS</div>
          <div className="text-2xl font-black text-slate-900">{stats.tripsCompleted}</div>
          <div className="text-[10px] font-semibold text-slate-500">Navigation sessions</div>
        </div>
      </div>
    </div>
  );
}
