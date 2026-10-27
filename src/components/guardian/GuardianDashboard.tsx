import {
  Battery, MapPin, AlertTriangle, Eye, Mic, Cpu, Radio,
  ChevronRight, CheckCircle2, ShieldAlert, Navigation, ArrowUpRight
} from 'lucide-react';
import type { GuardianLiveState } from '../../lib/guardianRealtimeSync';

interface GuardianDashboardProps {
  liveState: GuardianLiveState;
  onNavigateTab: (tabId: string) => void;
  onTriggerSOS: () => void;
}

export default function GuardianDashboard({ liveState, onNavigateTab, onTriggerSOS }: GuardianDashboardProps) {
  const { device, location, navigation, alerts, stats } = liveState;

  const isCritical = device.safetyStatus === 'CRITICAL';
  const isWarning = device.safetyStatus === 'WARNING';
  const battery = Math.min(100, Math.max(0, device.battery || 85));

  const batteryColor = battery > 50
    ? 'bg-emerald-500'
    : battery > 20
    ? 'bg-amber-500'
    : 'bg-red-500';

  const batteryTextColor = battery > 50
    ? 'text-emerald-600'
    : battery > 20
    ? 'text-amber-600'
    : 'text-red-600';

  const unresolvedAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="space-y-6">
      
      {/* Emergency Hospital Urgent Header Banner */}
      {(isCritical || (navigation.active && navigation.destination.toLowerCase().includes('hospital'))) && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-3xl p-6 shadow-xl border border-red-400/40 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner">
              🚑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white text-red-700 text-[11px] font-black tracking-wider uppercase">
                  CRITICAL EMERGENCY HOSPITAL ROUTE
                </span>
                <span className="text-xs text-white/90 font-medium">
                  Live GPS Synced from Glasses
                </span>
              </div>
              <h2 className="text-xl font-black mt-1">
                Routing User to: {navigation.destination || 'Nearest Emergency Care'}
              </h2>
              <div className="text-sm text-white/90 mt-0.5 flex flex-wrap items-center gap-3">
                <span>Distance: <strong>{navigation.distanceRemaining || 'Calculating...'}</strong></span>
                <span>•</span>
                <span>Estimated Arrival: <strong>{navigation.etaMinutes} mins</strong></span>
                {navigation.currentStep && (
                  <>
                    <span>•</span>
                    <span>Step: <em>{navigation.currentStep}</em></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('tracking')}
              className="px-5 py-2.5 bg-white text-red-700 hover:bg-slate-100 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" /> View Live Map
            </button>
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${encodeURIComponent(navigation.destination)}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-black/30 hover:bg-black/40 text-white text-xs font-black rounded-xl transition-all backdrop-blur-md border border-white/20 flex items-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" /> Google Maps
            </a>
          </div>
        </div>
      )}

      {/* Top Banner Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: User Safety & Health Status */}
        <div className={`bg-white rounded-2xl p-6 shadow-sm border transition-all ${
          isCritical
            ? 'border-red-300 ring-2 ring-red-500/20 bg-red-50/20'
            : isWarning
            ? 'border-amber-300 bg-amber-50/10'
            : 'border-slate-200/80'
        } space-y-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">User Safety & Status</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              isCritical
                ? 'bg-red-100 text-red-700 animate-pulse'
                : isWarning
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isCritical ? 'bg-red-600 animate-ping' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              {isCritical ? '🚨 SOS CRITICAL' : (isWarning ? '🟡 WARNING' : '🟢 SAFE')}
            </span>
          </div>

          <div>
            <div className="text-xl font-extrabold text-slate-900">{device.userName || 'Rahul (Smart Glasses User)'}</div>
            <div className="text-xs text-slate-500 mt-0.5">Glasses ID: #{device.glassesId || 'VG-8842'}</div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Battery className={`w-4 h-4 ${batteryTextColor}`} /> Glasses Battery
              </span>
              <span className={batteryTextColor}>{battery}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${batteryColor} rounded-full transition-all duration-500`}
                style={{ width: `${battery}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Current GPS Location */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Location</span>
              <span className="text-xs font-bold text-primary-600 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-primary-600 animate-pulse" />
                {device.networkStatus || 'Online (4G LTE)'}
              </span>
            </div>

            <div className="flex items-start gap-2.5 mt-3">
              <MapPin className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-slate-800 leading-snug">
                  {location.address || 'Detecting address...'}
                </div>
                <div className="text-xs font-mono text-slate-500 mt-1">
                  {location.latitude.toFixed(4)}° N, {location.longitude.toFixed(4)}° E
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Updated: {location.lastUpdated || 'Just now'}</span>
            <button
              onClick={() => onNavigateTab('tracking')}
              className="font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              Live Map <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 3: Active Navigation HUD */}
        <div className={`rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between text-white ${
          navigation.active
            ? 'bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900'
            : 'bg-gradient-to-br from-slate-800 to-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5" /> Active Navigation
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              navigation.active
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse'
                : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
            }`}>
              {navigation.active ? 'IN PROGRESS' : 'IDLE / STANDBY'}
            </span>
          </div>

          <div className="my-3">
            <div className="text-[10px] uppercase font-bold text-primary-300">DESTINATION</div>
            <div className="text-base font-extrabold truncate">
              {navigation.active ? navigation.destination : 'No active walking trip'}
            </div>
            {navigation.active && navigation.currentStep && (
              <div className="text-xs text-slate-300 mt-1 truncate">
                👉 {navigation.currentStep}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
            <div>
              <div className="text-[10px] opacity-70">DISTANCE</div>
              <div className="text-base font-black">
                {navigation.active ? (navigation.distanceRemaining || '--') : '--'}
              </div>
            </div>
            <div>
              <div className="text-[10px] opacity-70">ESTIMATED TIME</div>
              <div className="text-base font-black">
                {navigation.active ? (navigation.etaMinutes ? `${navigation.etaMinutes} mins` : '--') : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Device Sensors Health & Recent Safety Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Device Sensors Health */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary-600" />
            Glasses Hardware & Sensors
          </h3>

          <div className="space-y-3">
            {[
              { label: 'Glasses Front Camera', status: device.cameraActive ? 'Active (Webcam / PiCam)' : 'Standby', icon: Eye, active: device.cameraActive },
              { label: 'Directional Microphone', status: device.micActive ? 'Continuous Listening' : 'Muted', icon: Mic, active: device.micActive },
              { label: 'High-Precision GPS Engine', status: device.gpsActive ? 'Active (Sub-meter fix)' : 'Inactive', icon: Radio, active: device.gpsActive },
              { label: 'Neural AI Core & Vision', status: device.aiActive ? 'Real-Time Edge Inference' : 'Offline', icon: Cpu, active: device.aiActive },
            ].map(sensor => (
              <div key={sensor.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <sensor.icon className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800">{sensor.label}</span>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  sensor.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {sensor.status}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={onTriggerSOS}
              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" /> Trigger Emergency Check
            </button>
          </div>
        </div>

        {/* Live Safety Alerts Stream */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              Live Safety & Hazard Feed
            </h3>
            <button
              onClick={() => onNavigateTab('alerts')}
              className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View All ({alerts.length}) <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {unresolvedAlerts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">No Active Unresolved Alerts</div>
              <p className="text-xs text-slate-500">The user is currently walking safely with no detected hazards.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unresolvedAlerts.slice(0, 3).map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                    alert.risk === 'CRITICAL' || alert.risk === 'HIGH'
                      ? 'bg-red-50/50 border-red-200'
                      : 'bg-amber-50/40 border-amber-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        alert.risk === 'CRITICAL' || alert.risk === 'HIGH'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {alert.risk}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900">{alert.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">({alert.timestamp})</span>
                    </div>
                    <p className="text-xs text-slate-600">{alert.description}</p>
                  </div>
                  <button
                    onClick={() => onNavigateTab('alerts')}
                    className="p-1.5 text-primary-600 hover:bg-white rounded-lg transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Metrics Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">OBJECTS DETECTED</div>
          <div className="text-2xl font-black text-slate-900">{stats.objectsDetected}</div>
          <div className="text-[10px] font-semibold text-emerald-600">Active real-time scans</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">SAFETY ALERTS</div>
          <div className="text-2xl font-black text-amber-600">{stats.safetyAlertsCount}</div>
          <div className="text-[10px] font-semibold text-slate-500">
            {unresolvedAlerts.length} currently active
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">ESTIMATED MOBILITY</div>
          <div className="text-2xl font-black text-slate-900">{stats.distanceWalkedKm} km</div>
          <div className="text-[10px] font-semibold text-emerald-600">Walking telemetry</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">COMPLETED TRIPS</div>
          <div className="text-2xl font-black text-slate-900">{stats.tripsCompleted}</div>
          <div className="text-[10px] font-semibold text-slate-500">Voice GPS guided</div>
        </div>
      </div>

    </div>
  );
}
