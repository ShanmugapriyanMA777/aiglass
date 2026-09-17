/**
 * VisionAssist AI Glasses - Destination Parser
 * Natural language intent and destination extraction module for voice-controlled navigation.
 */

export type TravelMode = 'walking' | 'driving' | 'bicycling' | 'transit';

export type NavigationCommandType = 
  | 'NAVIGATION' 
  | 'CANCEL_NAVIGATION' 
  | 'START_NAVIGATION' 
  | 'CHANGE_DESTINATION' 
  | 'WHERE_AM_I' 
  | 'HOW_FAR' 
  | 'UNKNOWN';

export interface ParsedNavigation {
  intent: NavigationCommandType;
  destination: string | null;
  travel_mode: TravelMode;
  isAmbiguous: boolean;
  clarificationPrompt?: string;
  rawQuery: string;
}

/**
 * Normalizes user text and strips leading wake words / polite prefixes.
 */
function cleanQueryText(text: string): string {
  return text
    .trim()
    .replace(/^(?:hey\s+|ok\s+|okay\s+|hello\s+|hi\s+)?visionassist\s*[,:]?\s*/i, '')
    .replace(/^(?:please\s+|can\s+you\s+|could\s+you\s+)?/i, '')
    .trim();
}

/**
 * Extracts travel mode from query string.
 * Defaults to configured default mode or 'walking'.
 */
export function extractTravelMode(query: string, defaultMode: TravelMode = 'walking'): TravelMode {
  const q = query.toLowerCase();

  // Driving indicators
  if (/\b(?:by\s+)?(?:car|driving|drive|cab|taxi|uber|auto|vehicle)\b/i.test(q) || /\bdrive\s+me\b/i.test(q)) {
    return 'driving';
  }

  // Bicycling indicators
  if (/\b(?:by\s+)?(?:bike|bicycle|cycling|cycle)\b/i.test(q)) {
    return 'bicycling';
  }

  // Transit indicators
  if (/\b(?:by\s+)?(?:bus|train|transit|metro|subway|railway)\b/i.test(q) && !/\brailway\s+station\b/i.test(q) && !/\bbus\s+stop\b/i.test(q) && !/\bbus\s+stand\b/i.test(q)) {
    return 'transit';
  }

  // Explicit walking indicators
  if (/\b(?:by\s+)?(?:walking|walk|on\s+foot|foot)\b/i.test(q) || /\bwalk\s+me\b/i.test(q)) {
    return 'walking';
  }

  return defaultMode;
}

/**
 * Extracts destination string from natural language text.
 */
export function extractDestination(query: string): string {
  let cleaned = cleanQueryText(query);

  // 1. Strip trailing punctuation first so trailing phrases match
  cleaned = cleaned.replace(/[.,?!;:]+$/, '').trim();

  // 2. Strip leading navigation trigger phrases
  const triggerPatterns = [
    /^(?:take\s+me\s+to|navigate\s+(?:me\s+)?to|guide\s+me\s+to|directions?\s+to|route\s+to|go\s+to|drive\s+me\s+to|walk\s+me\s+to|bring\s+me\s+to|head\s+to|lead\s+me\s+to)\s+/i,
    /^how\s+(?:do|can)\s+i\s+get\s+to\s+/i,
    /^(?:i\s+want\s+to\s+go\s+to|i\s+need\s+to\s+go\s+to|i\s+would\s+like\s+to\s+go\s+to)\s+/i,
    /^(?:change\s+destination\s+to|set\s+destination\s+to|switch\s+destination\s+to)\s+/i,
    /^(?:find\s+way\s+to|show\s+(?:me\s+)?(?:the\s+)?way\s+to)\s+/i,
  ];

  for (const pattern of triggerPatterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '').trim();
      break;
    }
  }

  // 3. Remove trailing travel mode indicators e.g. "by car", "by walking", "on foot", "by bike"
  cleaned = cleaned.replace(/\s+(?:by\s+(?:walking|driving|car|bike|bicycle|bus|train|transit|metro|cab|taxi)|on\s+foot)\s*$/i, '').trim();

  // 4. Strip leading "the " if before common destinations (e.g. "the railway station" -> "railway station"), keeping "the nearest ..."
  if (/^the\s+(?!nearest\b|closest\b)/i.test(cleaned)) {
    cleaned = cleaned.replace(/^the\s+/i, '').trim();
  }

  // 5. Strip any trailing punctuation
  cleaned = cleaned.replace(/[.,?!;:]+$/, '').trim();

  return cleaned;
}

/**
 * Determines if a query is a navigation control command.
 */
export function parseNavigationIntent(query: string, defaultMode: TravelMode = 'walking'): ParsedNavigation {
  const raw = query.trim();
  const cleaned = cleanQueryText(raw).toLowerCase().replace(/[.,?!]+$/, '').trim();

  // 1. Cancel / Stop Navigation commands
  if (
    cleaned === 'cancel navigation' ||
    cleaned === 'stop navigation' ||
    cleaned === 'cancel route' ||
    cleaned === 'stop route' ||
    cleaned === 'end navigation' ||
    cleaned === 'exit navigation' ||
    cleaned === 'cancel'
  ) {
    return {
      intent: 'CANCEL_NAVIGATION',
      destination: null,
      travel_mode: defaultMode,
      isAmbiguous: false,
      rawQuery: raw,
    };
  }

  // 2. Start Navigation command
  if (cleaned === 'start navigation' || cleaned === 'begin navigation' || cleaned === 'start route') {
    return {
      intent: 'START_NAVIGATION',
      destination: null,
      travel_mode: defaultMode,
      isAmbiguous: false,
      rawQuery: raw,
    };
  }

  // 3. Where Am I commands
  if (
    cleaned === 'where am i' ||
    cleaned === 'where am i right now' ||
    cleaned === 'what is my location' ||
    cleaned === 'current location' ||
    cleaned === 'tell me my location'
  ) {
    return {
      intent: 'WHERE_AM_I',
      destination: null,
      travel_mode: defaultMode,
      isAmbiguous: false,
      rawQuery: raw,
    };
  }

  // 4. How Far commands
  if (
    cleaned === 'how far' ||
    cleaned === 'how far is my destination' ||
    cleaned === 'how far to my destination' ||
    cleaned === 'how much distance is left' ||
    cleaned === 'remaining distance' ||
    cleaned === 'how long will it take' ||
    cleaned === 'how long' ||
    cleaned === 'what is the eta'
  ) {
    return {
      intent: 'HOW_FAR',
      destination: null,
      travel_mode: defaultMode,
      isAmbiguous: false,
      rawQuery: raw,
    };
  }

  // 5. Change Destination without specific place or ambiguous "somewhere else"
  if (
    cleaned === 'change destination' ||
    cleaned === 'take me somewhere else' ||
    cleaned === 'navigate somewhere else' ||
    cleaned === 'go somewhere else' ||
    cleaned === 'switch destination'
  ) {
    return {
      intent: 'CHANGE_DESTINATION',
      destination: null,
      travel_mode: defaultMode,
      isAmbiguous: true,
      clarificationPrompt: 'Which location do you mean?',
      rawQuery: raw,
    };
  }

  // 6. Change destination to specific place
  if (/^(?:change|set|switch)\s+destination\s+to\s+/i.test(cleaned)) {
    const dest = extractDestination(raw);
    const mode = extractTravelMode(raw, defaultMode);
    if (!dest || dest.length < 2 || /^(?:somewhere|place|there|here)$/i.test(dest)) {
      return {
        intent: 'CHANGE_DESTINATION',
        destination: null,
        travel_mode: mode,
        isAmbiguous: true,
        clarificationPrompt: 'Which location do you mean?',
        rawQuery: raw,
      };
    }
    return {
      intent: 'CHANGE_DESTINATION',
      destination: dest,
      travel_mode: mode,
      isAmbiguous: false,
      rawQuery: raw,
    };
  }

  // 7. General Navigation command detection
  const navTriggers = [
    /\b(?:take\s+me\s+to)\b/i,
    /\b(?:navigate(?:\s+me)?\s+to)\b/i,
    /\b(?:guide\s+me\s+to)\b/i,
    /\b(?:how\s+(?:do|can)\s+i\s+get\s+to)\b/i,
    /\b(?:directions?\s+to)\b/i,
    /\b(?:route\s+to)\b/i,
    /\b(?:go\s+to)\b/i,
    /\b(?:drive\s+me\s+to)\b/i,
    /\b(?:walk\s+me\s+to)\b/i,
    /\b(?:i\s+want\s+to\s+go\s+to)\b/i,
    /\b(?:take\s+me\s+home)\b/i,
    /\b(?:go\s+home)\b/i,
  ];

  const hasNavTrigger = navTriggers.some((t) => t.test(raw));

  if (hasNavTrigger) {
    const dest = extractDestination(raw);
    const mode = extractTravelMode(raw, defaultMode);

    // Check for ambiguous or empty destination
    if (!dest || dest.length < 2 || /^(?:somewhere|place|there|here|somewhere else|destination)$/i.test(dest)) {
      return {
        intent: 'NAVIGATION',
        destination: null,
        travel_mode: mode,
        isAmbiguous: true,
        clarificationPrompt: 'Which location do you mean?',
        rawQuery: raw,
      };
    }

    return {
      intent: 'NAVIGATION',
      destination: dest,
      travel_mode: mode,
      isAmbiguous: false,
      rawQuery: raw,
    };
  }

  return {
    intent: 'UNKNOWN',
    destination: null,
    travel_mode: defaultMode,
    isAmbiguous: false,
    rawQuery: raw,
  };
}
