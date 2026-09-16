import React from 'react';
import { FileText, Download, Calendar, BarChart2, Eye, ShieldAlert, Navigation } from 'lucide-react';

export default function GuardianReports() {
  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,Date,Detections,SafetyAlerts,TripsCompleted,AvgBattery\n2026-08-12,247,3,4,78%\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "visionassist_daily_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Daily Safety & AI Usage Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">Exportable logs, risk metrics, and daily usage statistics</p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export CSV Report
        </button>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">OBJECTS DETECTED</div>
          <div className="text-2xl font-black text-slate-900">247</div>
          <div className="text-[10px] font-semibold text-emerald-600">↑ 14% vs yesterday</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">SAFETY ALERTS</div>
          <div className="text-2xl font-black text-amber-600">3</div>
          <div className="text-[10px] font-semibold text-slate-500">All 3 resolved</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">DISTANCE WALKED</div>
          <div className="text-2xl font-black text-slate-900">5.8 km</div>
          <div className="text-[10px] font-semibold text-emerald-600">Active mobility</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">COMPLETED TRIPS</div>
          <div className="text-2xl font-black text-slate-900">4</div>
          <div className="text-[10px] font-semibold text-slate-500">Navigation success</div>
        </div>
      </div>
    </div>
  );
}
