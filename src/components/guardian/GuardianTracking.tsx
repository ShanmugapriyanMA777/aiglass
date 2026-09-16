import React, { useState } from 'react';
import { MapPin, Navigation, Radio, Shield, Compass, LocateFixed, Layers } from 'lucide-react';

export default function GuardianTracking() {
  const [zoomLevel, setZoomLevel] = useState(15);
  
  // Current user GPS coords
  const lat = 12.9716;
  const lng = 80.2454;
  const address = "Agni College Campus, OMR Road, Thalambur, Chennai";

  return (
    <div className="space-y-6">
      {/* Map Control Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{address}</div>
            <div className="text-xs text-slate-500 font-mono">Coordinates: {lat}° N, {lng}° E</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Live GPS Signal Active
          </span>
          <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1">
            <LocateFixed className="w-3.5 h-3.5" /> Center Map
          </button>
        </div>
      </div>

      {/* Embedded Live Interactive Map View */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative min-h-[500px]">
        {/* OpenStreetMap iframe / Canvas map view */}
        <iframe
          title="Live User Tracking Map"
          width="100%"
          height="520"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
          className="w-full h-[520px] rounded-3xl"
        />

        {/* Floating Map Overlay HUD */}
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl max-w-xs space-y-2 border border-white/10">
          <div className="flex items-center justify-between text-xs font-bold border-b border-white/10 pb-2">
            <span className="flex items-center gap-1 text-primary-400">
              <Compass className="w-4 h-4" /> USER TELEMETRY
            </span>
            <span className="text-emerald-400">● MOVING</span>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Current Speed:</span>
              <span className="font-bold">3.2 km/h (Walking)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Heading:</span>
              <span className="font-bold">North-East (45°)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Accuracy:</span>
              <span className="font-bold text-emerald-400">High (&lt; 2 meters)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
