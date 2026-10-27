import { useState } from 'react';
import { Settings, Shield, CheckCircle2 } from 'lucide-react';

import type { GuardianLiveState } from '../../lib/guardianRealtimeSync';

interface GuardianSettingsProps {
  liveState?: GuardianLiveState;
}

export default function GuardianSettings({ liveState }: GuardianSettingsProps) {
  const [shareLocation, setShareLocation] = useState(true);
  const [shareAlerts, setShareAlerts] = useState(true);
  const [shareOCR, setShareOCR] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-600" />
            Guardian Privacy & Telemetry Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-1">Configure data sync, safety alert push triggers, and privacy controls</p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          {saved ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : null}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {liveState && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-800">Connected Smart Glasses: </span>
            <span className="text-slate-600 font-medium">{liveState.device.userName} (#{liveState.device.glassesId})</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
            {liveState.device.networkStatus}
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-600" />
          Real-Time Data Sharing Permissions
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-slate-800">Share Live GPS Location</div>
              <div className="text-[11px] text-slate-500">Allow Guardian Portal to track live position and route progress.</div>
            </div>
            <input
              type="checkbox"
              checked={shareLocation}
              onChange={(e) => setShareLocation(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-slate-800">Share Emergency SOS Alerts</div>
              <div className="text-[11px] text-slate-500">Instantly stream emergency SOS signals to authorized guardians.</div>
            </div>
            <input
              type="checkbox"
              checked={shareAlerts}
              onChange={(e) => setShareAlerts(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-slate-800">Share OCR & Spoken Readouts</div>
              <div className="text-[11px] text-slate-500">Allow guardians to review text readouts and detected signs.</div>
            </div>
            <input
              type="checkbox"
              checked={shareOCR}
              onChange={(e) => setShareOCR(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
