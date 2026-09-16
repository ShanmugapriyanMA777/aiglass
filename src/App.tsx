import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import GuardianPortal from './components/guardian/GuardianPortal';

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'guardian'>('landing');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (view === 'guardian') {
    return <GuardianPortal onExitPortal={() => setView('landing')} />;
  }

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white text-center py-2 font-semibold shadow-md flex items-center justify-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
          <span>Offline Mode Enabled – Using Local AI Features</span>
        </div>
      )}
      {!isOffline && view === 'dashboard' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-green-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center space-x-1.5 transition-all">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>Online Mode</span>
        </div>
      )}
      
      {view === 'dashboard' ? (
        <Dashboard onExit={() => setView('landing')} isOffline={isOffline} />
      ) : (
        <LandingPage
          onStartDemo={() => setView('dashboard')}
          onOpenGuardian={() => setView('guardian')}
        />
      )}
    </>
  );
}

