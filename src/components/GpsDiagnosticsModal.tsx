// GPS Diagnostics & Health Monitor Modal Component

import React, { useState, useEffect } from 'react';
import { LocationEngine, type TrustedLocation } from '../lib/LocationEngine';
import { Navigation, ShieldCheck, AlertOctagon, Activity, Radio, X } from 'lucide-react';

interface GpsDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GpsDiagnosticsModal: React.FC<GpsDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [location, setLocation] = useState<TrustedLocation | null>(null);
  const [stats, setStats] = useState(LocationEngine.getStats());

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = LocationEngine.subscribe((loc) => {
      setLocation(loc);
      setStats(LocationEngine.getStats());
    });

    const interval = setInterval(() => {
      setStats(LocationEngine.getStats());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getStatusBg = (status?: string) => {
    switch (status) {
      case 'excellent': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'moderate': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'poor': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Modal Header -->
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">VisionAssist Location Engine Diagnostics</h3>
              <p className="text-xs text-slate-400">GPS Health Monitor & Validation Logs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          <!-- Accuracy & Status Card -->
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase">GPS Source</span>
              <div className="font-bold text-slate-800 text-sm mt-1">{location?.source.toUpperCase() || 'SEARCHING'}</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Accuracy Radius</span>
              <div className="font-bold text-blue-600 text-sm mt-1">±{location?.accuracy || 0} meters</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Status Quality</span>
              <div className={`inline-block px-2 py-0.5 mt-1 text-xs font-extrabold rounded-full border ${getStatusBg(location?.status)}`}>
                {location?.status ? location.status.toUpperCase() : 'UNKNOWN'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Movement Mode</span>
              <div className="font-bold text-slate-800 text-sm mt-1">
                {location?.isStationary ? 'STATIONARY' : `${location?.speed ? (location.speed * 3.6).toFixed(1) : 0} km/h`}
              </div>
            </div>
          </div>

          <!-- Coords & Metrics -->
          <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 font-mono text-sm">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-400">LATITUDE / LONGITUDE:</span>
              <span className="text-emerald-400 font-bold">{location?.latitude || '0.000000'}°, {location?.longitude || '0.000000'}°</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-400">HEADING BEARING:</span>
              <span className="text-blue-400 font-bold">{location?.heading !== null ? `${location?.heading}°` : 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">TOTAL TRAVELLED:</span>
              <span className="text-amber-400 font-bold">{stats.totalDistanceKm} km</span>
            </div>
          </div>

          <!-- Accepted vs Rejected Readings Counter -->
          <div className="flex gap-4">
            <div className="flex-1 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-xs font-bold text-emerald-700 uppercase">Accepted GPS Readings</span>
              <div className="text-2xl font-extrabold text-emerald-800">{stats.acceptedCount}</div>
            </div>
            <div className="flex-1 p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <span className="text-xs font-bold text-rose-700 uppercase">Rejected / Jump Filtered</span>
              <div className="text-2xl font-extrabold text-rose-800">{stats.rejectedCount}</div>
            </div>
          </div>

          <!-- Realtime Validation Debug Log -->
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Realtime Validation Debug Log</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Time</th>
                    <th className="p-2">Coords</th>
                    <th className="p-2">Accuracy</th>
                    <th className="p-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.debugLogs.slice().reverse().map((log, i) => (
                    <tr key={i} className={log.status === 'REJECTED' ? 'bg-rose-50/50' : ''}>
                      <td className="p-2 text-slate-500">{log.timestamp}</td>
                      <td className="p-2 font-mono">{log.rawLat.toFixed(4)}, {log.rawLng.toFixed(4)}</td>
                      <td className="p-2 font-semibold">±{log.accuracy}m</td>
                      <td className="p-2">
                        {log.status === 'ACCEPTED' ? (
                          <span className="text-emerald-700 font-bold">✓ PASS</span>
                        ) : (
                          <span className="text-rose-600 font-bold">✕ {log.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
