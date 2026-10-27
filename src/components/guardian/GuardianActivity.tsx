import { Activity, Eye, Volume2, DollarSign, Mic, Clock, Navigation, AlertTriangle } from 'lucide-react';
import type { GuardianLiveState } from '../../lib/guardianRealtimeSync';

interface GuardianActivityProps {
  liveState: GuardianLiveState;
}

export default function GuardianActivity({ liveState }: GuardianActivityProps) {
  const activities = liveState.activities || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600" />
            AI Activity & Real-Time Interaction Timeline
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Live telemetry of AI visual scans, spoken OCR, currency identification, and voice commands
          </p>
        </div>

        <span className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-bold rounded-full border border-primary-200">
          {activities.length} Recorded Activities
        </span>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
        {activities.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No activity recorded yet. Spoken text and AI scans from smart glasses will appear here.
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-100 pl-6 space-y-6 ml-3">
            {activities.map(item => (
              <div key={item.id} className="relative">
                {/* Icon Marker */}
                <div className={`absolute -left-9 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                  item.type === 'sos'
                    ? 'bg-red-100 text-red-600'
                    : item.type === 'currency'
                    ? 'bg-amber-100 text-amber-600'
                    : item.type === 'ocr'
                    ? 'bg-blue-100 text-blue-600'
                    : item.type === 'nav'
                    ? 'bg-emerald-100 text-emerald-600'
                    : item.type === 'voice'
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-primary-100 text-primary-600'
                }`}>
                  {item.type === 'currency' && <DollarSign className="w-3.5 h-3.5" />}
                  {item.type === 'ocr' && <Volume2 className="w-3.5 h-3.5" />}
                  {item.type === 'object' && <Eye className="w-3.5 h-3.5" />}
                  {item.type === 'voice' && <Mic className="w-3.5 h-3.5" />}
                  {item.type === 'nav' && <Navigation className="w-3.5 h-3.5" />}
                  {item.type === 'sos' && <AlertTriangle className="w-3.5 h-3.5" />}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-900">{item.title}</h3>
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {item.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
