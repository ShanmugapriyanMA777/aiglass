import { useState } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');

  if (view === 'dashboard') {
    return <Dashboard onExit={() => setView('landing')} />;
  }

  return <LandingPage onStartDemo={() => setView('dashboard')} />;
}
