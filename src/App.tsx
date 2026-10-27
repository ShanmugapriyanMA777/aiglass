import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import GuardianPortal from './components/guardian/GuardianPortal';

export default function App() {
  const getInitialView = (): 'landing' | 'dashboard' | 'guardian' => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (hash === '#guardian' || params.get('view') === 'guardian' || params.get('portal') === 'guardian') {
        return 'guardian';
      }
      if (hash === '#dashboard' || params.get('view') === 'dashboard') {
        return 'dashboard';
      }
    }
    return 'landing';
  };

  const [view, setView] = useState<'landing' | 'dashboard' | 'guardian'>(getInitialView);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#guardian') setView('guardian');
      else if (hash === '#dashboard') setView('dashboard');
      else if (hash === '#landing' || hash === '') setView('landing');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  const changeView = (newView: 'landing' | 'dashboard' | 'guardian') => {
    setView(newView);
    if (typeof window !== 'undefined') {
      window.location.hash = newView;
    }
  };

  if (view === 'guardian') {
    return (
      <GuardianPortal
        onExitPortal={() => changeView('landing')}
        onOpenGlasses={() => changeView('dashboard')}
      />
    );
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
        <Dashboard
          onExit={() => changeView('landing')}
          onOpenGuardian={() => changeView('guardian')}
          isOffline={isOffline}
        />
      ) : (
        <LandingPage
          onStartDemo={() => changeView('dashboard')}
          onOpenGuardian={() => changeView('guardian')}
        />
      )}
    </>
  );
}

