import React, { useState, useEffect } from 'react';
import { Shield, MapPin, AlertTriangle, Activity, FileText, Settings, LogOut, ArrowLeft, User, Bell } from 'lucide-react';
import GuardianLogin from './GuardianLogin';
import GuardianDashboard from './GuardianDashboard';
import GuardianTracking from './GuardianTracking';
import GuardianAlerts from './GuardianAlerts';
import GuardianActivity from './GuardianActivity';
import GuardianReports from './GuardianReports';
import GuardianSettings from './GuardianSettings';

interface GuardianPortalProps {
  onExitPortal?: () => void;
}

export default function GuardianPortal({ onExitPortal }: GuardianPortalProps) {
  const [user, setUser] = useState<{ name: string; email: string; id: string }>(() => {
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

  const handleLoginSuccess = (userData: { name: string; email: string; id: string }) => {
    setUser(userData);
    localStorage.setItem('vg_guardian_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('vg_guardian_user');
  };

  const triggerSOSAlert = async () => {
    setSosModalOpen(true);
    await fetch('http://localhost:8000/api/guardian/sos', { method: 'POST' }).catch(() => null);
  };

  if (!user) {
    return <GuardianLogin onLoginSuccess={handleLoginSuccess} onBackToApp={onExitPortal} />;
  }

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
              User <b>Rahul</b> triggered Emergency SOS from smart glasses button!
            </p>
            <div className="bg-slate-50 p-3 rounded-xl text-xs text-left space-y-1 font-mono text-slate-700">
              <div><b>Location:</b> Agni College Campus, Chennai</div>
              <div><b>Time:</b> Just now</div>
              <div><b>Status:</b> Immediate Response Needed</div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSosModalOpen(false)}
                className="flex-1 py-3 bg-red-600 text-white font-extrabold text-xs rounded-xl hover:bg-red-700 transition-all shadow-lg"
              >
                Acknowledge Alert
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-white text-base">Guardian Portal</div>
                <div className="text-[10px] text-slate-400">VisionAssist AI</div>
              </div>
            </div>

            {onExitPortal && (
              <button
                onClick={onExitPortal}
                title="Back to User App"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 text-xs font-bold">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Shield },
              { id: 'tracking', label: 'Live GPS Tracking', icon: MapPin },
              { id: 'alerts', label: 'Safety & SOS Alerts', icon: AlertTriangle },
              { id: 'activity', label: 'AI Activity & OCR', icon: Activity },
              { id: 'reports', label: 'Daily Reports', icon: FileText },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
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
        <header className="bg-white border-b border-slate-200/80 px-8 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-extrabold text-slate-900">
              {activeTab === 'dashboard' && 'User Safety Overview'}
              {activeTab === 'tracking' && 'Live GPS Tracking Map'}
              {activeTab === 'alerts' && 'Safety & Emergency SOS Alerts'}
              {activeTab === 'activity' && 'AI Activity & OCR Readings'}
              {activeTab === 'reports' && 'Daily Summary Reports'}
              {activeTab === 'settings' && 'Device & Privacy Settings'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
              🟢 SAFE
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={triggerSOSAlert}
              title="Test Emergency SOS"
              className="p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 transition-all"
            >
              <Bell className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pl-4 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800">{user.name}</div>
                <div className="text-[10px] text-slate-500">Authorized Guardian</div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Content Body */}
        <div className="p-8 flex-1">
          {activeTab === 'dashboard' && (
            <GuardianDashboard
              onNavigateTab={(tab) => setActiveTab(tab as any)}
              onTriggerSOS={triggerSOSAlert}
            />
          )}
          {activeTab === 'tracking' && <GuardianTracking />}
          {activeTab === 'alerts' && <GuardianAlerts />}
          {activeTab === 'activity' && <GuardianActivity />}
          {activeTab === 'reports' && <GuardianReports />}
          {activeTab === 'settings' && <GuardianSettings />}
        </div>
      </main>

    </div>
  );
}
