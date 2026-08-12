import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Bell, Volume2, Clock, Check } from 'lucide-react';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
}

const initialAlerts: AlertItem[] = [
  {
    id: 'alt_1',
    title: 'Vehicle Approaching — High Risk',
    description: 'Car detected on zebra crossing at 2.4m distance. Warning spoken immediately to user.',
    risk: 'HIGH',
    timestamp: '10:32 AM',
    acknowledged: false,
    resolved: false
  },
  {
    id: 'alt_2',
    title: 'Uneven Footpath Obstacle',
    description: 'Construction barrier detected 1.5m ahead on left side.',
    risk: 'MEDIUM',
    timestamp: '10:15 AM',
    acknowledged: true,
    resolved: true
  },
  {
    id: 'alt_3',
    title: 'Safe Zebra Crossing Identified',
    description: 'Green pedestrian traffic light confirmed via computer vision.',
    risk: 'LOW',
    timestamp: '10:02 AM',
    acknowledged: true,
    resolved: true
  }
];

export default function GuardianAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);

  const handleAcknowledge = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const handleResolve = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, resolved: true } : a));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Safety & Emergency SOS Alerts Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">Real-time risk warnings & user emergency SOS signals</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-extrabold rounded-full">
            {alerts.filter(a => !a.resolved).length} Active Unresolved Alerts
          </span>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${
              alert.resolved
                ? 'border-slate-200 opacity-75'
                : alert.risk === 'HIGH' || alert.risk === 'CRITICAL'
                ? 'border-red-300 ring-2 ring-red-500/10'
                : 'border-amber-200'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    alert.risk === 'HIGH' || alert.risk === 'CRITICAL'
                      ? 'bg-red-100 text-red-800'
                      : alert.risk === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {alert.risk} RISK
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 pt-1">
                  <Clock className="w-3 h-3" /> Timestamp: {alert.timestamp}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    Acknowledge
                  </button>
                )}

                {!alert.resolved ? (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Resolve Alert
                  </button>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Resolved
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
