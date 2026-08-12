/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

interface MapPanelProps {
  currentLocation: [number, number] | null;
  destination: [number, number] | null;
  routeCoordinates: [number, number][];
  simulatedUserLocation: [number, number] | null;
  mapType?: 'standard' | 'dark' | 'satellite';
  accuracyMeters?: number;
}

export default function MapPanel({
  currentLocation,
  destination,
  routeCoordinates,
  simulatedUserLocation,
  mapType = 'standard',
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  
  const startMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = (window as any).L;
    if (!L) {
      console.error('Leaflet is not loaded on window');
      return;
    }

    // Default center Chennai/India or current location
    const center: [number, number] = currentLocation || [12.9716, 80.2454];
    
    // Create Map
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(center, 15);

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let options = {};

    if (mapType === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else if (mapType === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      options = {
        maxZoom: 19,
      };
    }

    tileLayerRef.current = L.tileLayer(url, options).addTo(map);
  }, [mapType, currentLocation]); // recreate tile when mapType updates

  // Update Markers and Polyline
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    // 1. Start Marker
    if (currentLocation) {
      if (startMarkerRef.current) {
        startMarkerRef.current.setLatLng(currentLocation);
      } else {
        const startIcon = L.divIcon({
          html: `<div class="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center font-bold text-[9px] text-white">S</div>`,
          className: 'custom-map-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        startMarkerRef.current = L.marker(currentLocation, { icon: startIcon })
          .addTo(map)
          .bindPopup('Start Location');
      }
    } else if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }

    // 2. Destination Marker
    if (destination) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng(destination);
      } else {
        const destIcon = L.divIcon({
          html: `<div class="w-6 h-6 rounded-full bg-red-600 border-2 border-white shadow-xl flex items-center justify-center font-bold text-[9px] text-white animate-bounce">D</div>`,
          className: 'custom-map-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        destMarkerRef.current = L.marker(destination, { icon: destIcon })
          .addTo(map)
          .bindPopup('Destination');
      }
    } else if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }

    // 3. User Location Marker & Dynamic Accuracy Radius Circle
    const activeUserLoc = simulatedUserLocation || currentLocation;
    if (activeUserLoc) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(activeUserLoc);
      } else {
        const userIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center w-6 h-6">
              <span class="absolute inline-flex w-full h-full rounded-full bg-primary-400 opacity-75 animate-ping"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-primary-600 border-2 border-white shadow-md"></span>
            </div>
          `,
          className: 'custom-map-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        userMarkerRef.current = L.marker(activeUserLoc, { icon: userIcon })
          .addTo(map)
          .bindPopup('Your Current Location');
      }

      // Render Dynamic GPS Accuracy Circle
      const radiusMeters = accuracyMeters || 10;
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng(activeUserLoc);
        accuracyCircleRef.current.setRadius(radiusMeters);
      } else {
        accuracyCircleRef.current = L.circle(activeUserLoc, {
          radius: radiusMeters,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(map);
      }
    } else {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
    }

    // 4. Polyline route
    if (routeCoordinates && routeCoordinates.length > 0) {
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(routeCoordinates);
      } else {
        polylineRef.current = L.polyline(routeCoordinates, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.8,
          dashArray: '5, 8',
        }).addTo(map);
      }
    } else if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Auto-zoom to fit path if route exists
    if (routeCoordinates && routeCoordinates.length > 1) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (activeUserLoc) {
      map.setView(activeUserLoc, 16);
    }
  }, [currentLocation, destination, routeCoordinates, simulatedUserLocation]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-inner border border-slate-100 bg-slate-100">
      <div ref={containerRef} className="w-full h-full z-10" />
      {/* Map styling overlay */}
      <div className="absolute bottom-2 left-2 z-20 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] text-slate-500 font-medium pointer-events-none">
        OpenStreetMap & OSRM
      </div>
    </div>
  );
}
