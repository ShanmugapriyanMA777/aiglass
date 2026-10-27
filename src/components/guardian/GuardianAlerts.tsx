import { CheckCircle2, ShieldAlert, Clock, Check, Bell } from 'lucide-react';
import {
  acknowledgeAlert,
  resolveAlert,
  type GuardianLiveState
} from '../../lib/guardianRealtimeSync';

interface GuardianAlertsProps {
  liveState: GuardianLiveState;
  onTriggerSOS?: () => void;
}

export default function GuardianAlerts({ liveState, onTriggerSOS }: GuardianAlertsProps) {
  const alerts = liveState.alerts || [];

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert(id);
  };

  const handleResolve = (id: string) => {
    resolveAlert(id);
  };

  const unresolvedAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Safety & Emergency SOS Alerts Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time hazard notifications, vehicle warnings, and user emergency SOS signals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 text-xs font-extrabold rounded-full ${
            unresolvedAlerts.length > 0
              ? 'bg-red-100 text-red-800 animate-pulse'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {unresolvedAlerts.length} Active Unresolved Alerts
          </span>

          {onTriggerSOS && (
            <button
              onClick={onTriggerSOS}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" /> Trigger Test SOS
            </button>
          )}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">All Clear — No Alerts Logged</h3>
            <p className="text-xs text-slate-500">Hazards detected by VisionAssist glasses will appear here immediately.</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${
                alert.resolved
                  ? 'border-slate-200 opacity-60'
                  : alert.risk === 'CRITICAL'
                  ? 'border-red-400 ring-2 ring-red-500/20 bg-red-50/20'
                  : alert.risk === 'HIGH'
                  ? 'border-amber-300 ring-2 ring-amber-500/10'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      alert.risk === 'CRITICAL'
                        ? 'bg-red-600 text-white animate-pulse'
                        : alert.risk === 'HIGH'
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
                    {alert.latitude && alert.longitude && (
                      <span className="ml-2 font-mono text-slate-400">
                        • Coordinates: {alert.latitude.toFixed(4)}°, {alert.longitude.toFixed(4)}°
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
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
          ))
        )}
      </div>

    </div>
  );
}
