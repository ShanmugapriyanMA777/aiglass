/**
 * VisionAssist AI Glasses - Navigation Service
 * Central orchestrator for voice-controlled navigation, session management,
 * safety guardrails, and accessibility-compliant voice feedback.
 */

import { parseNavigationIntent, ParsedNavigation, TravelMode } from './destinationParser';
import { generateGoogleMapsUrl, launchGoogleMaps, LaunchResult } from './googleMapsLauncher';

export interface NavigationSessionState {
  isActive: boolean;
  destination: string | null;
  travelMode: TravelMode;
  googleMapsUrl: string | null;
  startedAt: number | null;
}

export interface NavigationServiceResponse {
  success: boolean;
  intent: ParsedNavigation['intent'];
  destination?: string | null;
  travel_mode?: TravelMode;
  google_maps_url?: string | null;
  spoken_response: string;
  post_launch_response?: string;
  should_launch: boolean;
  isAmbiguous?: boolean;
  error?: string;
}

export interface NavigationOptions {
  userCoords?: [number, number] | null;
  defaultMode?: TravelMode;
  speakCallback?: (text: string) => void;
  autoLaunch?: boolean;
}

export class NavigationService {
  private static instance: NavigationService;

  private state: NavigationSessionState = {
    isActive: false,
    destination: null,
    travelMode: 'walking',
    googleMapsUrl: null,
    startedAt: null,
  };

  private defaultTravelMode: TravelMode = 'walking';
  private isNavigationEnabled: boolean = true;

  constructor() {
    // Read environment defaults if available
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        const envMode = (import.meta.env.VITE_DEFAULT_TRAVEL_MODE || import.meta.env.DEFAULT_TRAVEL_MODE) as TravelMode;
        if (envMode && ['walking', 'driving', 'bicycling', 'transit'].includes(envMode)) {
          this.defaultTravelMode = envMode;
        }
        const envEnabled = import.meta.env.VITE_ENABLE_NAVIGATION ?? import.meta.env.ENABLE_NAVIGATION;
        if (envEnabled !== undefined) {
          this.isNavigationEnabled = String(envEnabled).toLowerCase() !== 'false';
        }
      }
    } catch {
      // ignore
    }
  }

  public static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  public isEnabled(): boolean {
    return this.isNavigationEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.isNavigationEnabled = enabled;
  }

  public getDefaultTravelMode(): TravelMode {
    return this.defaultTravelMode;
  }

  public setDefaultTravelMode(mode: TravelMode) {
    this.defaultTravelMode = mode;
  }

  public getState(): NavigationSessionState {
    return { ...this.state };
  }

  /**
   * Main entry point: parses voice command, manages session state,
   * provides voice prompts, and triggers Google Maps navigation.
   */
  public async handleVoiceQuery(
    queryText: string,
    options: NavigationOptions = {}
  ): Promise<NavigationServiceResponse> {
    if (!this.isNavigationEnabled) {
      return {
        success: false,
        intent: 'UNKNOWN',
        spoken_response: 'Navigation feature is currently disabled.',
        should_launch: false,
      };
    }

    const defaultMode = options.defaultMode || this.defaultTravelMode;
    const parsed = parseNavigationIntent(queryText, defaultMode);

    switch (parsed.intent) {
      case 'CANCEL_NAVIGATION': {
        this.state = {
          isActive: false,
          destination: null,
          travelMode: defaultMode,
          googleMapsUrl: null,
          startedAt: null,
        };
        const msg = 'Navigation cancelled.';
        if (options.speakCallback) options.speakCallback(msg);
        return {
          success: true,
          intent: 'CANCEL_NAVIGATION',
          spoken_response: msg,
          should_launch: false,
        };
      }

      case 'START_NAVIGATION': {
        if (!this.state.destination) {
          const msg = 'Which location do you mean?';
          if (options.speakCallback) options.speakCallback(msg);
          return {
            success: false,
            intent: 'START_NAVIGATION',
            spoken_response: msg,
            should_launch: false,
          };
        }
        return this.startNavigationTo(this.state.destination, this.state.travelMode, options);
      }

      case 'WHERE_AM_I': {
        const coords = options.userCoords;
        let msg = '';
        if (!coords || isNaN(coords[0]) || isNaN(coords[1])) {
          msg = 'Your current location is unavailable.';
        } else if (this.state.isActive && this.state.destination) {
          msg = `You are currently navigating to ${this.state.destination}.`;
        } else {
          msg = `Your current coordinates are latitude ${coords[0].toFixed(4)}, longitude ${coords[1].toFixed(4)}.`;
        }
        if (options.speakCallback) options.speakCallback(msg);
        return {
          success: true,
          intent: 'WHERE_AM_I',
          spoken_response: msg,
          should_launch: false,
        };
      }

      case 'HOW_FAR': {
        if (!this.state.isActive || !this.state.destination) {
          const msg = 'No active navigation session.';
          if (options.speakCallback) options.speakCallback(msg);
          return {
            success: false,
            intent: 'HOW_FAR',
            spoken_response: msg,
            should_launch: false,
          };
        }
        const msg = `Navigating to ${this.state.destination}. Google Maps is monitoring the active route.`;
        if (options.speakCallback) options.speakCallback(msg);
        return {
          success: true,
          intent: 'HOW_FAR',
          destination: this.state.destination,
          travel_mode: this.state.travelMode,
          spoken_response: msg,
          should_launch: false,
        };
      }

      case 'CHANGE_DESTINATION':
      case 'NAVIGATION': {
        if (parsed.isAmbiguous || !parsed.destination) {
          const msg = parsed.clarificationPrompt || 'Which location do you mean?';
          if (options.speakCallback) options.speakCallback(msg);
          return {
            success: false,
            intent: parsed.intent,
            isAmbiguous: true,
            spoken_response: msg,
            should_launch: false,
          } as NavigationServiceResponse;
        }

        return this.startNavigationTo(parsed.destination, parsed.travel_mode, options);
      }

      default: {
        return {
          success: false,
          intent: 'UNKNOWN',
          spoken_response: '',
          should_launch: false,
        };
      }
    }
  }

  /**
   * Initiates navigation to a specific destination and travel mode.
   */
  public async startNavigationTo(
    destination: string,
    travelMode: TravelMode = 'walking',
    options: NavigationOptions = {}
  ): Promise<NavigationServiceResponse> {
    const mapsUrl = generateGoogleMapsUrl(destination, travelMode, options.userCoords);

    // Update active session state
    this.state = {
      isActive: true,
      destination,
      travelMode,
      googleMapsUrl: mapsUrl,
      startedAt: Date.now(),
    };

    // Voice response format:
    // If travel mode is explicitly walking or driving etc, provide natural phrase
    const preLaunchSpeech = travelMode === 'walking'
      ? `Starting walking navigation to ${destination}.`
      : `Starting ${travelMode} navigation to ${destination}.`;

    const postLaunchSpeech = 'Google Maps navigation started.';

    // Spoken confirmation before launch
    if (options.speakCallback) {
      options.speakCallback(preLaunchSpeech);
    }

    const autoLaunch = options.autoLaunch !== false;
    let launchResult: LaunchResult = {
      success: true,
      url: mapsUrl,
      method: 'web_url',
    };

    if (autoLaunch) {
      launchResult = await launchGoogleMaps(destination, travelMode, options.userCoords);

      if (launchResult.success) {
        if (options.speakCallback) {
          // Speak confirmation after short delay to allow transition
          setTimeout(() => {
            options.speakCallback?.(postLaunchSpeech);
          }, 800);
        }
      } else {
        const errorSpeech = "I couldn't open Google Maps.";
        if (options.speakCallback) {
          options.speakCallback(errorSpeech);
        }
        return {
          success: false,
          intent: 'NAVIGATION',
          destination,
          travel_mode: travelMode,
          google_maps_url: mapsUrl,
          spoken_response: errorSpeech,
          should_launch: false,
          error: launchResult.error,
        };
      }
    }

    return {
      success: true,
      intent: 'NAVIGATION',
      destination,
      travel_mode: travelMode,
      google_maps_url: mapsUrl,
      spoken_response: preLaunchSpeech,
      post_launch_response: postLaunchSpeech,
      should_launch: true,
    };
  }

  /**
   * Direct manual cancellation.
   */
  public cancelNavigation(speakCallback?: (text: string) => void): NavigationServiceResponse {
    this.state = {
      isActive: false,
      destination: null,
      travelMode: this.defaultTravelMode,
      googleMapsUrl: null,
      startedAt: null,
    };
    const msg = 'Navigation cancelled.';
    if (speakCallback) speakCallback(msg);
    return {
      success: true,
      intent: 'CANCEL_NAVIGATION',
      spoken_response: msg,
      should_launch: false,
    };
  }
}

export const navigationService = NavigationService.getInstance();
