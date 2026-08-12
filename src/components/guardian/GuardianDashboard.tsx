import React from 'react';
import { Shield, Battery, MapPin, Navigation, AlertTriangle, Activity, Eye, Mic, Cpu, Radio, ChevronRight, CheckCircle2 } from 'lucide-react';

interface GuardianDashboardProps {
  onNavigateTab: (tabId: string) => void;
  onTriggerSOS: () => void;
}

export default function GuardianDashboard({ onNavigateTab, onTriggerSOS }: GuardianDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Top Banner Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: User Safety & Health Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">User Safety & Status</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              🟢 SAFE
            </span>
          </div>

          <div>
            <div className="text-xl font-extrabold text-slate-900">Rahul (Visually Impaired User)</div>
            <div className="text-xs text-slate-500 mt-1">Smart Glasses ID: #VG-8842</div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1.5"><Battery className="w-4 h-4 text-emerald-600" /> Glasses Battery</span>
              <span>78%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '78%' }} />
            </div>
          </div>
        </div>

        {/* Card 2: Current GPS Location */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Location</span>
            <span className="text-xs font-bold text-primary-600 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-primary-600 animate-pulse" />
              Online (4G)
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-slate-800">Agni College Campus, OMR Road, Chennai</div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">12.9716° N, 80.2454° E</div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('tracking')}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 pt-1"
          >
            View Live Tracking Map <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Active Navigation HUD */}
        <div className="bg-gradient-to-br from-slate-900 to-primary-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-70">Active Navigation HUD</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
              IN PROGRESS
            </span>
          </div>

          <div className="my-2">
            <div className="text-[10px] uppercase font-bold text-primary-300">DESTINATION</div>
            <div className="text-lg font-extrabold truncate">Apollo Hospital, Main Entrance</div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
            <div>
              <div className="text-[10px] opacity-70">DISTANCE</div>
              <div className="text-base font-black">650 m</div>
            </div>
            <div>
              <div className="text-[10px] opacity-70">ETA</div>
              <div className="text-base font-black">8 mins</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: AI Engine Status & Safety Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Device Sensors Health */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary-600" />
            Device Health & Sensors
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary-500" /> Camera Feed
              </span>
              <span className="font-bold text-emerald-600">● Active</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary-500" /> Microphone
              </span>
              <span className="font-bold text-emerald-600">● Active</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-500" /> GPS Hardware
              </span>
              <span className="font-bold text-emerald-600">● Active</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary-500" /> AI Vision Engine
              </span>
              <span className="font-bold text-emerald-600">● Active</span>
            </div>
          </div>

          <button
            onClick={onTriggerSOS}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            TRIGGER GUARDIAN SOS SIMULATION
          </button>
        </div>

        {/* Safety Alerts Log Summary */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Intelligent Safety Alerts (Real-Time Stream)
            </h3>
            <button
              onClick={() => onNavigateTab('alerts')}
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              View All Alerts
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-red-50 border-l-4 border-red-500 flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold text-red-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  Vehicle Approaching — High Risk
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Car detected on zebra crossing at 2.4m distance. Warning spoken immediately.</div>
              </div>
              <span className="text-[10px] font-bold text-slate-400">10:32 AM</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border-l-4 border-amber-500 flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Uneven Footpath Obstacle
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Construction barrier detected 1.5m ahead on left side.</div>
              </div>
              <span className="text-[10px] font-bold text-slate-400">10:15 AM</span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border-l-4 border-emerald-500 flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Safe Zebra Crossing Detected
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Green signal confirmed. Safe pedestrian crossing announced.</div>
              </div>
              <span className="text-[10px] font-bold text-slate-400">10:02 AM</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
