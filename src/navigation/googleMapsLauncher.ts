/**
 * VisionAssist AI Glasses - Google Maps Launcher
 * Generates deep links / universal URLs and handles opening Google Maps navigation
 * without requiring any Google Maps API keys or Cloud developer APIs.
 */

import { TravelMode } from './destinationParser';

export interface LaunchResult {
  success: boolean;
  url: string;
  method: 'android_intent' | 'web_url';
  error?: string;
}

/**
 * Checks if current browser environment is running on an Android device.
 */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

/**
 * Generates standard Universal Google Maps URL.
 * Does NOT require any Google API Key.
 * Format: https://www.google.com/maps/dir/?api=1&destination=...&travelmode=...
 */
export function generateGoogleMapsUrl(
  destination: string,
  travelMode: TravelMode = 'walking',
  userCoords?: [number, number] | null
): string {
  const cleanDest = destination.trim();
  const encodedDest = encodeURIComponent(cleanDest);
  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}&travelmode=${travelMode}&dir_action=navigate`;

  if (userCoords && Array.isArray(userCoords) && userCoords.length === 2 && !isNaN(userCoords[0]) && !isNaN(userCoords[1])) {
    url += `&origin=${userCoords[0].toFixed(6)},${userCoords[1].toFixed(6)}`;
  }

  return url;
}

/**
 * Generates Android Native Google Maps Intent URI.
 * Format: google.navigation:q=Destination&mode=w
 */
export function generateAndroidIntentUrl(
  destination: string,
  travelMode: TravelMode = 'walking'
): string {
  const modeMap: Record<TravelMode, string> = {
    walking: 'w',
    driving: 'd',
    bicycling: 'b',
    transit: 'r',
  };
  const modeCode = modeMap[travelMode] || 'w';
  return `google.navigation:q=${encodeURIComponent(destination.trim())}&mode=${modeCode}`;
}

/**
 * Opens Google Maps navigation either via Android Intent (if on Android) or Universal Web URL.
 */
export async function launchGoogleMaps(
  destination: string,
  travelMode: TravelMode = 'walking',
  userCoords?: [number, number] | null
): Promise<LaunchResult> {
  const webUrl = generateGoogleMapsUrl(destination, travelMode, userCoords);

  if (typeof window === 'undefined') {
    return {
      success: true,
      url: webUrl,
      method: 'web_url',
    };
  }

  const isAndroid = isAndroidDevice();

  if (isAndroid) {
    const androidIntent = generateAndroidIntentUrl(destination, travelMode);
    try {
      // Try opening native Android intent
      window.location.href = androidIntent;

      // Fallback timer: if still on page after 1.5s, trigger web URL
      setTimeout(() => {
        try {
          window.open(webUrl, '_blank', 'noopener,noreferrer');
        } catch {
          // ignore
        }
      }, 1500);

      return {
        success: true,
        url: androidIntent,
        method: 'android_intent',
      };
    } catch (e) {
      console.warn('[GoogleMapsLauncher] Android intent failed, falling back to web URL:', e);
    }
  }

  // Standard web browser launch
  try {
    const win = window.open(webUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      // If popup blocked, navigate current window
      window.location.href = webUrl;
    }
    return {
      success: true,
      url: webUrl,
      method: 'web_url',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[GoogleMapsLauncher] Failed to launch Google Maps URL:', errorMessage);
    return {
      success: false,
      url: webUrl,
      method: 'web_url',
      error: errorMessage,
    };
  }
}
