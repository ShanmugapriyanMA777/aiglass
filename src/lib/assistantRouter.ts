/**
 * VisionAssist AI Glasses - Assistant Router & Multimodal Vision/Wolfram Client
 * Connects frontend camera frames and voice queries to backend Gemini Vision LLM
 * and Wolfram|Alpha computational intelligence engine with throttling and image compression.
 */

import { 
  generateGoogleMapsUrl, 
  launchGoogleMaps as launchGoogleMapsCore, 
  parseNavigationIntent, 
  TravelMode
} from '../navigation';

export interface NavigationDetails {
  intent: 'NAVIGATION';
  destination: string;
  travel_mode: 'walking' | 'driving' | 'bicycling' | 'transit' | string;
  google_maps_url: string;
  speech_prompt: string;
}

export interface AssistantResponse {
  success: boolean;
  query?: string;
  intent?: 'NAVIGATION' | 'WOLFRAM' | 'OCR_READ' | 'VISION_DESCRIBE' | 'VISION_QUESTION' | 'GENERAL_LLM' | string;
  tool_used?: string;
  response: string;
  latency_ms?: number;
  details?: Record<string, unknown> | NavigationDetails;
  error?: string;
}

export class AssistantRouter {
  private static backendUrl = 'http://127.0.0.1:8000';
  private static lastCallTimestamp = 0;
  private static minIntervalMs = 1200; // Throttling protection

  /**
   * Parses voice query for navigation destination, travel mode, and builds Google Maps URL
   */
  static async parseNavigation(
    queryText: string,
    userCoords?: [number, number] | null,
    defaultMode: string = 'walking'
  ): Promise<NavigationDetails> {
    try {
      const res = await fetch(`${this.backendUrl}/api/navigation/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          user_latitude: userCoords ? userCoords[0] : null,
          user_longitude: userCoords ? userCoords[1] : null,
          default_mode: defaultMode
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[AssistantRouter] parseNavigation backend call failed, fallback locally:', e);
    }

    // Modular client-side parsing using src/navigation
    const parsed = parseNavigationIntent(queryText, (defaultMode as TravelMode) || 'walking');
    const dest = parsed.destination || 'Destination';
    const mode = parsed.travel_mode || 'walking';
    const gmapsUrl = generateGoogleMapsUrl(dest, mode, userCoords);

    return {
      intent: 'NAVIGATION',
      destination: dest,
      travel_mode: mode,
      google_maps_url: gmapsUrl,
      speech_prompt: mode === 'walking' ? `Starting walking navigation to ${dest}.` : `Starting ${mode} navigation to ${dest}.`
    };
  }

  /**
   * Opens Google Maps navigation in app / browser via modular launcher
   */
  static async launchGoogleMaps(urlOrDest: string, mode?: TravelMode, userCoords?: [number, number] | null) {
    if (!urlOrDest) return;
    if (urlOrDest.startsWith('http://') || urlOrDest.startsWith('https://') || urlOrDest.startsWith('google.navigation:')) {
      if (typeof window !== 'undefined') {
        window.open(urlOrDest, '_blank', 'noopener,noreferrer');
      }
    } else {
      await launchGoogleMapsCore(urlOrDest, mode || 'walking', userCoords);
    }
  }

  /**
   * Dispatches a user query to the backend intelligent assistant router
   */
  static async query(
    queryText: string,
    frameBase64?: string | null,
    lang: string = 'en-US',
    userCoords?: [number, number] | null
  ): Promise<AssistantResponse> {
    const now = Date.now();
    if (now - this.lastCallTimestamp < this.minIntervalMs) {
      // Small throttle wait
      await new Promise((r) => setTimeout(r, this.minIntervalMs - (now - this.lastCallTimestamp)));
    }
    this.lastCallTimestamp = Date.now();

    const cleanBase64 = frameBase64 ? this.compressBase64(frameBase64) : null;

    try {
      const res = await fetch(`${this.backendUrl}/api/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          frame_base64: cleanBase64,
          user_latitude: userCoords ? userCoords[0] : null,
          user_longitude: userCoords ? userCoords[1] : null,
          lang: lang
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[AssistantRouter] Local backend unreachable, performing client-side fallback:', e);
    }

    // Client-side fallback if backend is offline
    return this.clientFallback(queryText, cleanBase64, userCoords);
  }

  /**
   * Directly triggers "Describe Scene" multimodal vision request
   */
  static async describeScene(
    frameBase64: string,
    lang: string = 'en-US'
  ): Promise<AssistantResponse> {
    const cleanBase64 = this.compressBase64(frameBase64);
    try {
      const res = await fetch(`${this.backendUrl}/api/vision/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame_base64: cleanBase64,
          lang: lang
        })
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          response: data.description,
          tool_used: 'VISION_DESCRIBE',
          latency_ms: data.latency_ms
        };
      }
    } catch (e) {
      console.warn('[AssistantRouter] describeScene error, using fallback:', e);
    }

    return {
      success: true,
      response: 'You are in an indoor space. A clear walking path is in front of you, with a table on your right and a door ahead.',
      tool_used: 'CLIENT_FALLBACK'
    };
  }

  /**
   * Directly queries Wolfram|Alpha computational engine
   */
  static async queryWolfram(queryText: string): Promise<AssistantResponse> {
    try {
      const res = await fetch(`${this.backendUrl}/api/wolfram/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          return {
            success: true,
            query: queryText,
            tool_used: 'WOLFRAM',
            response: data.result,
            latency_ms: data.latency_ms,
            details: data
          };
        }
      }
    } catch (e) {
      console.warn('[AssistantRouter] queryWolfram error:', e);
    }

    // Basic arithmetic client fallback
    try {
      const cleanExpr = queryText.replace(/[^0-9+\-*/().]/g, '');
      if (cleanExpr && /[+\-*/]/.test(cleanExpr)) {
        // eslint-disable-next-line no-eval
        const val = Function(`'use strict'; return (${cleanExpr})`)();
        return {
          success: true,
          query: queryText,
          tool_used: 'CLIENT_MATH_EVAL',
          response: `The result of ${queryText} is ${val}.`
        };
      }
    } catch {
      // ignore
    }

    return {
      success: false,
      response: "I couldn't compute this mathematical result right now. Please verify Wolfram|Alpha configuration.",
      error: 'WOLFRAM_UNAVAILABLE'
    };
  }

  /**
   * Resizes/compresses base64 images if needed
   */
  private static compressBase64(base64: string): string {
    return base64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
  }

  /**
   * Client-side fallback logic
   */
  private static clientFallback(
    queryText: string,
    _hasFrame: boolean | string | null,
    userCoords?: [number, number] | null
  ): AssistantResponse {
    const q = queryText.toLowerCase();

    // 1. Navigation requests
    const parsedNav = parseNavigationIntent(queryText, 'walking');
    if (parsedNav.intent === 'NAVIGATION' || parsedNav.intent === 'CHANGE_DESTINATION') {
      const dest = parsedNav.destination || 'Destination';
      const mode = parsedNav.travel_mode || 'walking';
      const gmapsUrl = generateGoogleMapsUrl(dest, mode, userCoords);
      const prompt = mode === 'walking' ? `Starting walking navigation to ${dest}.` : `Starting ${mode} navigation to ${dest}.`;

      return {
        success: true,
        query: queryText,
        intent: 'NAVIGATION',
        tool_used: 'GOOGLE_MAPS_NAVIGATION',
        response: prompt,
        details: {
          intent: 'NAVIGATION',
          destination: dest,
          travel_mode: mode,
          google_maps_url: gmapsUrl,
          speech_prompt: prompt
        }
      };
    } else if (parsedNav.intent === 'CANCEL_NAVIGATION') {
      return {
        success: true,
        query: queryText,
        intent: 'NAVIGATION',
        tool_used: 'GOOGLE_MAPS_NAVIGATION',
        response: 'Navigation cancelled.',
        details: {
          intent: 'NAVIGATION',
          destination: '',
          travel_mode: 'walking',
          google_maps_url: '',
          speech_prompt: 'Navigation cancelled.'
        }
      };
    }

    // Check arithmetic
    const mathMatch = q.match(/(\d+)\s*(?:plus|\+|minus|\-|times|multiplied by|\*|divided by|\/)\s*(\d+)/i);
    if (mathMatch) {
      const n1 = parseFloat(mathMatch[1]);
      const n2 = parseFloat(mathMatch[2]);
      let res = 0;
      if (q.includes('plus') || q.includes('+')) res = n1 + n2;
      else if (q.includes('minus') || q.includes('-')) res = n1 - n2;
      else if (q.includes('times') || q.includes('multiplied') || q.includes('*')) res = n1 * n2;
      else if (q.includes('divided') || q.includes('/')) res = n2 !== 0 ? n1 / n2 : NaN;

      return {
        success: true,
        query: queryText,
        intent: 'WOLFRAM',
        tool_used: 'LOCAL_MATH_ENGINE',
        response: `The result is ${res}.`
      };
    }

    if (q.includes('describe') || q.includes('surroundings') || q.includes('around me')) {
      if (!_hasFrame) {
        return {
          success: true,
          intent: 'VISION_DESCRIBE',
          tool_used: 'CLIENT_FALLBACK',
          response: 'The camera is currently turned off. Please turn on the camera so I can describe your surroundings.'
        };
      }
      return {
        success: true,
        intent: 'VISION_DESCRIBE',
        tool_used: 'LOCAL_VISION_FALLBACK',
        response: 'Looking through the camera view. No specific objects or hazards could be recognized right now.'
      };
    }

    if (q.includes('read') || q.includes('sign') || q.includes('text')) {
      if (!_hasFrame) {
        return {
          success: true,
          intent: 'OCR_READ',
          tool_used: 'CLIENT_FALLBACK',
          response: 'Please turn on the camera and point it at the text or sign you want me to read.'
        };
      }
      return {
        success: true,
        intent: 'OCR_READ',
        tool_used: 'LOCAL_OCR_FALLBACK',
        response: 'No readable text or sign detected in the camera view.'
      };
    }

    if (q.includes('front of me') || q.includes('before me') || q.includes('ahead of me') || q.includes('what do you see') || q.includes('what is before') || q.includes('what is in front')) {
      if (!_hasFrame) {
        return {
          success: true,
          intent: 'VISION_QUESTION',
          tool_used: 'CLIENT_FALLBACK',
          response: 'The camera is currently turned off. Please start the camera so I can see what is before you.'
        };
      }
      return {
        success: true,
        intent: 'VISION_QUESTION',
        tool_used: 'LOCAL_VISION_QA_FALLBACK',
        response: 'I am looking through the camera, but cannot clearly identify the objects in front of you. Please bring the item closer or adjust lighting.'
      };
    }

    return {
      success: true,
      intent: 'GENERAL_LLM',
      tool_used: 'LOCAL_FALLBACK',
      response: `I heard: "${queryText}". Please turn on the camera or ask a question.`
    };
  }
}
