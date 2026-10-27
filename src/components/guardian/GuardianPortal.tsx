import { useState, useEffect, useRef } from 'react';
import {
  Shield, MapPin, AlertTriangle, Activity, FileText, Settings,
  LogOut, ArrowLeft, Bell, Glasses, CheckCircle2
} from 'lucide-react';
import GuardianLogin from './GuardianLogin';
import GuardianDashboard from './GuardianDashboard';
import GuardianTracking from './GuardianTracking';
import GuardianAlerts from './GuardianAlerts';
import GuardianActivity from './GuardianActivity';
import GuardianReports from './GuardianReports';
import GuardianSettings from './GuardianSettings';
import {
  subscribeGuardianSync,
  getGuardianLiveState,
  triggerEmergencySOSFromPortal,
  acknowledgeAlert,
  resolveAlert,
  type GuardianLiveState
} from '../../lib/guardianRealtimeSync';

interface GuardianPortalProps {
  onExitPortal?: () => void;
  onOpenGlasses?: () => void;
}

export default function GuardianPortal({ onExitPortal, onOpenGlasses }: GuardianPortalProps) {
  const [user, setUser] = useState<{ name: string; email: string; id: string } | null>(() => {
    try {
      const saved = localStorage.getItem('vg_guardian_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    const defaultDemo = {
      name: 'Dr. Sarah Connor',
      email: 'sarah.connor@visionassist.ai',
      id: 'usr_demo_guardian'
    };
    localStorage.setItem('vg_guardian_user', JSON.stringify(defaultDemo));
    return defaultDemo;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'tracking' | 'alerts' | 'activity' | 'reports' | 'settings'>('dashboard');
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [liveState, setLiveState] = useState<GuardianLiveState>(getGuardianLiveState());
  const lastAlertIdRef = useRef<string>('');

  // Subscribe to real-time sync bus (cross-tab and local)
  useEffect(() => {
    const unsubscribe = subscribeGuardianSync((state) => {
      setLiveState(state);

      // Check if there is an unacknowledged CRITICAL SOS alert
      const activeSos = state.alerts.find(a => !a.acknowledged && a.risk === 'CRITICAL');
      if (activeSos && activeSos.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = activeSos.id;
        setSosModalOpen(true);
        playAlarmSound();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {}
  };

  const handleLoginSuccess = (userData: { name: string; email: string; id: string }) => {
    setUser(userData);
    localStorage.setItem('vg_guardian_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('vg_guardian_user');
  };

  const handleTriggerSOS = () => {
    const alert = triggerEmergencySOSFromPortal();
    lastAlertIdRef.current = alert.id;
    setSosModalOpen(true);
    playAlarmSound();
  };

  const handleAcknowledgeActiveSos = () => {
    const activeSos = liveState.alerts.find(a => !a.acknowledged && a.risk === 'CRITICAL');
    if (activeSos) {
      acknowledgeAlert(activeSos.id);
    }
    setSosModalOpen(false);
  };

  const handleResolveActiveSos = () => {
    const activeSos = liveState.alerts.find(a => a.risk === 'CRITICAL' && !a.resolved);
    if (activeSos) {
      resolveAlert(activeSos.id);
    }
    setSosModalOpen(false);
  };

  if (!user) {
    return (
      <GuardianLogin
        onLoginSuccess={handleLoginSuccess}
        onBackToApp={onOpenGlasses || onExitPortal}
      />
    );
  }

  const latestSos = liveState.alerts.find(a => a.risk === 'CRITICAL') || liveState.alerts[0];
  const activeAlertsCount = liveState.alerts.filter(a => !a.resolved).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
      
      {/* SOS Alert Modal Banner */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border-4 border-red-500 text-center space-y-4 animate-bounce-short">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl inline-flex items-center justify-center font-bold">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-red-600 uppercase tracking-wide">EMERGENCY SOS ALERT</h2>
            <p className="text-xs text-slate-600 font-semibold">
              User <b>{liveState.device.userName}</b> triggered Emergency SOS from smart glasses!
            </p>
            <div className="bg-slate-50 p-3.5 rounded-xl text-xs text-left space-y-1.5 font-mono text-slate-700 border border-slate-200">
              <div><b>Location:</b> {liveState.location.address}</div>
              <div><b>Coordinates:</b> {liveState.location.latitude.toFixed(4)}° N, {liveState.location.longitude.toFixed(4)}° E</div>
              <div><b>Time:</b> {latestSos?.timestamp || 'Just now'}</div>
              <div><b>Status:</b> Immediate Response Needed</div>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={handleAcknowledgeActiveSos}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all"
              >
                Acknowledge
              </button>
              <button
                onClick={handleResolveActiveSos}
                className="flex-1 py-3 bg-red-600 text-white font-extrabold text-xs rounded-xl hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Resolve SOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-white text-base">Guardian Portal</div>
                <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync Connected
                </div>
              </div>
            </div>

            {onExitPortal && (
              <button
                onClick={onExitPortal}
                title="Back to Landing Page"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Switch to Vision Glasses button */}
          {onOpenGlasses && (
            <div className="p-4 pb-2">
              <button
                onClick={onOpenGlasses}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white font-bold text-xs transition-all shadow-md"
              >
                <Glasses className="w-4 h-4" />
                <span>Switch to Vision Glasses</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 text-xs font-bold">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Shield, badge: null },
              { id: 'tracking', label: 'Live GPS Tracking', icon: MapPin, badge: 'LIVE' },
              { id: 'alerts', label: 'Safety & SOS Alerts', icon: AlertTriangle, badge: activeAlertsCount > 0 ? activeAlertsCount : null },
              { id: 'activity', label: 'AI Activity & OCR', icon: Activity, badge: null },
              { id: 'reports', label: 'Daily Reports', icon: FileText, badge: null },
              { id: 'settings', label: 'Settings', icon: Settings, badge: null },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    item.badge === 'LIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-red-600 hover:border-red-600 text-slate-300 hover:text-white font-bold text-xs transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Navbar Header */}
        <header className="bg-white border-b border-slate-200/80 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-extrabold text-slate-900">
              {activeTab === 'dashboard' && 'User Safety Overview'}
              {activeTab === 'tracking' && 'Live GPS Tracking Map'}
              {activeTab === 'alerts' && 'Safety & Emergency SOS Alerts'}
              {activeTab === 'activity' && 'AI Activity & OCR Readings'}
              {activeTab === 'reports' && 'Daily Summary Reports'}
              {activeTab === 'settings' && 'Device & Privacy Settings'}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              liveState.device.safetyStatus === 'CRITICAL'
                ? 'bg-red-100 text-red-700 animate-pulse ring-2 ring-red-500/20'
                : liveState.device.safetyStatus === 'WARNING'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {liveState.device.safetyStatus === 'CRITICAL' ? '🚨 SOS CRITICAL' : (liveState.device.safetyStatus === 'WARNING' ? '🟡 WARNING' : '🟢 SAFE')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleTriggerSOS}
              title="Test Emergency SOS Trigger"
              className="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Bell className="w-4 h-4 text-red-600" />
              <span>Test SOS</span>
            </button>

            <div className="flex items-center gap-2.5 pl-4 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800">{user.name}</div>
                <div className="text-[10px] text-slate-500">Authorized Caregiver</div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Content Body */}
        <div className="p-6 md:p-8 flex-1">
          {activeTab === 'dashboard' && (
            <GuardianDashboard
              liveState={liveState}
              onNavigateTab={(tab) => setActiveTab(tab as any)}
              onTriggerSOS={handleTriggerSOS}
            />
          )}
          {activeTab === 'tracking' && (
            <GuardianTracking liveState={liveState} />
          )}
          {activeTab === 'alerts' && (
            <GuardianAlerts
              liveState={liveState}
              onTriggerSOS={handleTriggerSOS}
            />
          )}
          {activeTab === 'activity' && (
            <GuardianActivity liveState={liveState} />
          )}
          {activeTab === 'reports' && (
            <GuardianReports liveState={liveState} />
          )}
          {activeTab === 'settings' && (
            <GuardianSettings liveState={liveState} />
          )}
        </div>
      </main>

    </div>
  );
}
