import { useState } from 'react';
import { MapPin, Radio, Compass, LocateFixed, ExternalLink } from 'lucide-react';
import type { GuardianLiveState } from '../../lib/guardianRealtimeSync';

interface GuardianTrackingProps {
  liveState: GuardianLiveState;
}

export default function GuardianTracking({ liveState }: GuardianTrackingProps) {
  const { location, device } = liveState;
  const lat = location.latitude || 12.9716;
  const lng = location.longitude || 80.2454;
  const address = location.address || 'Agni College Campus, OMR Road, Thalambur, Chennai';

  const [refreshKey, setRefreshKey] = useState(0);

  const delta = 0.006;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${(lng - delta).toFixed(5)}%2C${(lat - delta).toFixed(5)}%2C${(lng + delta).toFixed(5)}%2C${(lat + delta).toFixed(5)}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

  return (
    <div className="space-y-6">
      
      {/* Active Navigation / Emergency Hospital Live Banner */}
      {liveState.navigation.active && (
        <div className={`rounded-2xl p-5 border shadow-sm flex flex-wrap items-center justify-between gap-4 ${
          liveState.device.safetyStatus === 'CRITICAL'
            ? 'bg-gradient-to-r from-red-500/10 via-red-500/5 to-white border-red-300 ring-2 ring-red-500/20'
            : 'bg-gradient-to-r from-primary-500/10 to-white border-primary-200'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
              liveState.device.safetyStatus === 'CRITICAL'
                ? 'bg-red-600 text-white animate-bounce'
                : 'bg-primary-600 text-white'
            }`}>
              {liveState.device.safetyStatus === 'CRITICAL' ? '🚑' : '🧭'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                  liveState.device.safetyStatus === 'CRITICAL'
                    ? 'bg-red-600 text-white'
                    : 'bg-primary-100 text-primary-700'
                }`}>
                  {liveState.device.safetyStatus === 'CRITICAL' ? 'EMERGENCY HOSPITAL ROUTE ACTIVE' : 'ACTIVE ROUTE'}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ETA: <span className="text-slate-900 font-extrabold">{liveState.navigation.etaMinutes} mins</span> • Distance: <span className="text-slate-900 font-extrabold">{liveState.navigation.distanceRemaining}</span>
                </span>
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-1">
                Destination: {liveState.navigation.destination}
              </div>
              {liveState.navigation.currentStep && (
                <div className="text-xs text-slate-600 mt-0.5 font-medium">
                  Next Step: {liveState.navigation.currentStep}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${encodeURIComponent(liveState.navigation.destination)}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Track Route in Google Maps
            </a>
          </div>
        </div>
      )}

      {/* Map Control Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{address}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Live Coordinates: {lat.toFixed(5)}° N, {lng.toFixed(5)}° E • Updated: {location.lastUpdated || 'Just now'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>{device.networkStatus || '4G GPS Signal Active'}</span>
          </span>

          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            title="Refresh GPS Marker"
          >
            <LocateFixed className="w-3.5 h-3.5" /> Center Map
          </button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
          </a>
        </div>
      </div>

      {/* Embedded Live Interactive Map View */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative min-h-[520px]">
        <iframe
          key={`${lat}-${lng}-${refreshKey}`}
          title="Live User Tracking Map"
          width="100%"
          height="540"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={mapUrl}
          className="w-full h-[540px] rounded-3xl"
        />

        {/* Floating Telemetry HUD Overlay */}
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl max-w-xs space-y-2 border border-white/10">
          <div className="flex items-center justify-between text-xs font-bold border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 text-primary-400">
              <Compass className="w-4 h-4" /> USER TELEMETRY
            </span>
            <span className={location.speed > 0.5 ? 'text-emerald-400' : 'text-slate-400'}>
              ● {location.speed > 0.5 ? 'MOVING' : 'STATIONARY'}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-medium">
            <div className="flex justify-between">
              <span className="text-slate-400">Walking Speed:</span>
              <span className="font-bold">{location.speed} km/h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bearing Heading:</span>
              <span className="font-bold">{location.heading}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">GPS Accuracy:</span>
              <span className="font-bold text-emerald-400">&lt; {location.accuracy || 2.0} meters</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Safety Status:</span>
              <span className={`font-bold ${
                device.safetyStatus === 'CRITICAL' ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}>
                {device.safetyStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
