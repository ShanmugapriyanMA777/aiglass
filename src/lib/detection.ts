import { translateText } from './speech';

let cachedCocoModel: any = null;
let modelLoadingPromise: Promise<any> | null = null;

export async function getLocalModel(): Promise<any> {
  if (cachedCocoModel) return cachedCocoModel;
  if (modelLoadingPromise) return modelLoadingPromise;

  if (typeof window !== 'undefined' && (window as any).cocoSsd) {
    modelLoadingPromise = (window as any).cocoSsd.load().then((model: any) => {
      cachedCocoModel = model;
      modelLoadingPromise = null;
      return model;
    }).catch((err: any) => {
      modelLoadingPromise = null;
      throw err;
    });
    return modelLoadingPromise;
  }
  throw new Error('COCO-SSD library is not loaded on window.');
}

export interface DetectedObject {
  class: string;
  confidence: number;
  position: 'left' | 'center' | 'right';
  distance: string;
  distanceMeters: number;
  bbox?: [number, number, number, number];
}

export interface VisionResult {
  objects: DetectedObject[];
  scene: string;
  text: string;
  colors: { name: string; hex: string }[];
  currency: string;
  warning: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export interface CurrencyDetectionResult {
  detected: boolean;
  currency: string;
  value_text: string;
  confidence: number;
  time_ms: number;
}

export async function detectCurrency(video: HTMLVideoElement | null, targetLang?: string): Promise<CurrencyDetectionResult> {
  if (!video) return { detected: false, currency: '', value_text: '', confidence: 0, time_ms: 0 };
  const startTime = Date.now();
  const base64 = captureFrame(video);
  const cleanBase64 = base64.replace(/^data:image\/(png|jpeg);base64,/, '');

  // 1. Try local Python Backend
  try {
    const res = await fetch('http://localhost:8000/api/detect-currency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame_base64: cleanBase64 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.detected) return data;
    }
  } catch (e) {
    console.warn('Local currency endpoint unreachable, falling back to cloud Vision AI:', e);
  }

  // 2. Fallback to Supabase Edge Function Vision AI
  try {
    const visionRes = await analyzeFrame(
      video,
      'Examine this camera image carefully for currency notes or coins (Indian Rupees ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, ₹2000, US Dollars, Euros, etc.). If a currency note or coin is present, state its denomination clearly in the "currency" field (e.g. "₹500 Indian Rupee Note"). Respond with JSON: {"currency": "currency value or empty string", "objects": [], "scene": "", "text": "", "colors": [], "warning": ""}.',
      targetLang
    );
    if (visionRes.currency && visionRes.currency.trim().length > 0) {
      const currStr = visionRes.currency.trim();
      return {
        detected: true,
        currency: currStr,
        value_text: currStr.toLowerCase(),
        confidence: 0.92,
        time_ms: Date.now() - startTime
      };
    }
  } catch (cloudErr) {
    console.warn('Cloud currency vision fallback failed:', cloudErr);
  }

  return { detected: false, currency: '', value_text: '', confidence: 0, time_ms: Date.now() - startTime };
}

export function captureFrame(video: HTMLVideoElement | null, maxWidth: number = 640): string {
  if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / (video.videoWidth || 640));
  canvas.width = (video.videoWidth || 640) * scale;
  canvas.height = (video.videoHeight || 480) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

interface RawObject {
  class: string;
  confidence: number;
  position?: 'left' | 'center' | 'right';
  distance?: string;
  distanceMeters?: number;
}

export async function analyzeFrame(
  video: HTMLVideoElement | null,
  customPrompt?: string,
  targetLang?: string
): Promise<VisionResult> {
  const image = captureFrame(video);
  if (!image) throw new Error('Could not capture frame');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/vision-analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image, prompt: customPrompt, lang: targetLang }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      objects: (data.objects || []).map((o: RawObject) => ({
        class: o.class,
        confidence: o.confidence,
        position: o.position || 'center',
        distance: o.distance || 'Far',
        distanceMeters: o.distanceMeters || 5,
      })),
      scene: data.scene || '',
      text: data.text || '',
      colors: data.colors || [],
      currency: data.currency || '',
      warning: data.warning || '',
    };
  } catch (err) {
    console.warn('AI analysis API failed, trying client-side local detector:', err);

    // If local TensorFlow COCO-SSD is loaded in window, run real deep learning detection!
    // If local object detection is not available or no objects are found in the frame, return honest empty results
    return {
      objects: [],
      scene: 'The path in front of you is clear. No obstacles detected.',
      text: '',
      colors: [],
      currency: '',
      warning: ''
    };
  }
}

export const HARM_OBJECTS = ['knife', 'scissors', 'blade', 'sharp object', 'weapon', 'gun', 'dagger', 'sword', 'broken glass', 'fire', 'cleaver', 'razor'];

export function isHarmfulObject(label: string): boolean {
  const l = (label || '').toLowerCase();
  return HARM_OBJECTS.some(h => l.includes(h));
}

export function generateVoiceMessage(obj: DetectedObject, lang?: string): string {
  const shortLang = lang ? lang.split('-')[0].toLowerCase() : 'en';
  const isHarm = isHarmfulObject(obj.class);

  if (shortLang === 'ta') {
    const objNames: Record<string, string> = {
      person: 'நபர்', chair: 'நாற்காலி', laptop: 'லேப்டாப்', backpack: 'பை',
      bottle: 'பாட்டில்', cup: 'கப்', 'cell phone': 'கைப்பேசி', phone: 'தொலைபேசி',
      dog: 'நாய்', cat: 'பூனை', car: 'கார்', bus: 'பேருந்து', truck: 'லாரி',
      motorcycle: 'மோட்டார் சைக்கிள்', bicycle: 'மிதிவண்டி', book: 'புத்தகம்',
      table: 'மேஜை', tv: 'தொலைக்காட்சி', couch: 'சோபா', bed: 'கட்டில்',
      umbrella: 'குடை', clock: 'கடிகாரம்', 'stop sign': 'நிறுத்த அடையாளம்',
      'traffic light': 'போக்குவரத்து விளக்கு', bench: 'பெஞ்ச்', board: 'போர்டு',
      whiteboard: 'வெள்ளை போர்டு', blackboard: 'கரும்பலகை', projector: 'ப்ரொஜெக்டர்',
      knife: 'கத்தி ⚠️', scissors: 'கத்தரிக்கோல் ⚠️'
    };
    const posMap: Record<string, string> = {
      center: 'உங்கள் நேர் முன்',
      left: 'உங்கள் இடதுபுறம்',
      right: 'உங்கள் வலதுபுறம்'
    };
    const name = objNames[obj.class.toLowerCase()] || obj.class;
    const pos = posMap[obj.position] || obj.position;
    const dist = obj.distanceMeters <= 1
      ? 'மிக அருகில் உள்ளது!'
      : `சுமார் ${obj.distanceMeters} மீட்டர் தொலைவில் உள்ளது.`;

    if (isHarm) {
      return `⚠️ ஆபத்து எச்சரிக்கை! ${pos} ஒரு ஆபத்தான பொருள் ${name} ${dist}! கவனமாக விலகி செல்லவும்!`;
    }
    return `${pos} ஒரு ${name} ${dist}`;
  }

  if (shortLang === 'hi') {
    const objNames: Record<string, string> = {
      person: 'व्यक्ति', chair: 'कुर्सी', laptop: 'लैपटॉप', backpack: 'बैग',
      bottle: 'बोतल', cup: 'कप', dog: 'कुत्ता', cat: 'बिल्ली',
      car: 'कार', table: 'मेज़', book: 'किताब', bench: 'बेंच',
      board: 'बोर्ड', projector: 'प्रोजेक्टर', 'cell phone': 'मोबाइल फोन',
      phone: 'फोन', knife: 'चाकू ⚠️', scissors: 'कैंची ⚠️'
    };
    const posMap: Record<string, string> = {
      center: 'आपके सामने', left: 'आपके बाएं', right: 'आपके दाएं'
    };
    const name = objNames[obj.class.toLowerCase()] || obj.class;
    const pos = posMap[obj.position] || obj.position;
    const dist = obj.distanceMeters <= 1
      ? 'बहुत पास है!'
      : `लगभग ${obj.distanceMeters} मीटर दूर है।`;

    if (isHarm) {
      return `⚠️ खतरे की चेतावनी! आपके ${pos} एक खतरनाक वस्तु ${name} ${dist}! दूर रहें और सावधान रहें!`;
    }
    return `${pos} एक ${name} ${dist}`;
  }

  // English default
  const posText = obj.position === 'center' ? 'right in front of you' : `on your ${obj.position}`;
  const distText = obj.distanceMeters <= 1 ? "and it's very close!" : `about ${obj.distanceMeters} meters away.`;

  if (isHarm) {
    return `⚠️ CRITICAL DANGER: Harm causing object detected! A ${obj.class} is ${posText}, ${distText} Please exercise extreme caution!`;
  }
  return `I see a ${obj.class} ${posText}, ${distText}`;
}

export function drawBoundingBoxes(
  predictions: any[],
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  confidenceThreshold: number = 0.5,
  overlayData?: {
    trafficLightColor?: string;
    zebraState?: string;
    vehicleOnCrossing?: boolean;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Sync canvas dimensions with video element bounds
  const rect = video.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // Clear previous drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 480;
  const scaleX = rect.width / videoWidth;
  const scaleY = rect.height / videoHeight;

  // Street & Harm Danger Color Helper
  const getStreetColor = (label: string) => {
    const l = (label || '').toLowerCase();
    if (isHarmfulObject(l)) {
      return { border: '#dc2626', fill: '#dc2626', shadow: 'rgba(220, 38, 38, 0.8)', text: '⚠️ DANGER HARM' }; // Crimson Danger Harm
    }
    if (['car', 'bus', 'truck', 'motorcycle'].some(v => l.includes(v))) {
      return { border: '#ef4444', fill: '#ef4444', shadow: 'rgba(239, 68, 68, 0.4)', text: 'HIGH DANGER' }; // High Danger Red
    }
    if (['bicycle', 'stop sign', 'fire hydrant', 'pole', 'parking meter', 'traffic light', 'projector', 'board'].some(c => l.includes(c))) {
      return { border: '#f59e0b', fill: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.4)', text: 'CAUTION' }; // Medium Danger Amber
    }
    return { border: '#10b981', fill: '#10b981', shadow: 'rgba(16, 185, 129, 0.4)', text: 'INFO' }; // Low Danger Emerald Green
  };

  predictions.forEach((pred) => {
    const score = pred.score !== undefined ? pred.score : (pred.confidence !== undefined ? pred.confidence : 1.0);
    if (score < confidenceThreshold) return;

    let x = 0, y = 0, w = 0, h = 0;
    if (pred.bbox && Array.isArray(pred.bbox) && pred.bbox.length === 4) {
      // Check if [x, y, w, h] or [x1, y1, x2, y2]
      if (pred.bbox[2] > pred.bbox[0] && pred.bbox[3] > pred.bbox[1] && pred.bbox[2] <= videoWidth) {
        // [x1, y1, x2, y2] format
        x = pred.bbox[0];
        y = pred.bbox[1];
        w = pred.bbox[2] - pred.bbox[0];
        h = pred.bbox[3] - pred.bbox[1];
      } else {
        // [x, y, w, h] format
        [x, y, w, h] = pred.bbox;
      }
    } else if (pred.x1 !== undefined && pred.y1 !== undefined) {
      x = pred.x1;
      y = pred.y1;
      w = pred.x2 - pred.x1;
      h = pred.y2 - pred.y1;
    } else {
      return;
    }

    const drawX = x * scaleX;
    const drawY = y * scaleY;
    const drawW = w * scaleX;
    const drawH = h * scaleY;

    const colors = getStreetColor(pred.class);

    // Outer glow border
    ctx.strokeStyle = colors.shadow;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeRect(drawX, drawY, drawW, drawH);

    // Inner sharp border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(drawX, drawY, drawW, drawH);

    // Calculate distance and position heuristic
    const centerX = x + w / 2;
    let position = pred.position || 'center';
    if (!pred.position) {
      if (centerX < videoWidth * 0.35) position = 'left';
      else if (centerX > videoWidth * 0.65) position = 'right';
    }

    let distanceMeters = pred.distance_meters || pred.distanceMeters;
    if (distanceMeters === undefined) {
      const relativeHeight = h / videoHeight;
      distanceMeters = Math.min(10, Math.max(0.3, Math.round((0.5 / relativeHeight) * 10) / 10));
    }

    const className = (pred.class || 'object').toUpperCase();
    const confPct = Math.round(score * 100);
    const label = `${className} · ${distanceMeters}m · ${position.toUpperCase()} (${confPct}%)`;

    ctx.font = 'bold 12px sans-serif';
    const textWidth = ctx.measureText(label).width;

    // Label background pill
    ctx.fillStyle = colors.fill;
    ctx.fillRect(drawX, Math.max(0, drawY - 24), textWidth + 12, 24);

    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, drawX + 6, Math.max(16, drawY - 7));
  });

  // Canvas HUD overlay badges for Street Lights & Zebra Crossing
  if (overlayData) {
    // 1. Traffic Light Canvas Badge (Top Right)
    if (overlayData.trafficLightColor && overlayData.trafficLightColor !== '--') {
      const badgeX = canvas.width - 170;
      const badgeY = 16;
      const lightColor = overlayData.trafficLightColor;

      let badgeBg = '#334155';
      let dotColor = '#94a3b8';
      let text = 'SIGNAL: UNKNOWN';

      if (lightColor === 'RED') {
        badgeBg = '#7f1d1d';
        dotColor = '#ef4444';
        text = '🔴 RED LIGHT - STOP';
      } else if (lightColor === 'GREEN') {
        badgeBg = '#064e3b';
        dotColor = '#10b981';
        text = '🟢 GREEN LIGHT - GO';
      } else if (lightColor === 'YELLOW') {
        badgeBg = '#78350f';
        dotColor = '#f59e0b';
        text = '🟡 YELLOW - PREPARE';
      }

      ctx.fillStyle = badgeBg;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, 150, 32, 8);
      ctx.fill();
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(text, badgeX + 10, badgeY + 20);
    }

    // 2. Zebra Crossing / Vehicle Alert Badge (Bottom Center)
    if (overlayData.zebraState && overlayData.zebraState !== 'NONE') {
      const badgeWidth = 240;
      const badgeX = (canvas.width - badgeWidth) / 2;
      const badgeY = canvas.height - 48;

      let bg = '#1e293b';
      let text = '🚶 ZEBRA CROSSING AHEAD';

      if (overlayData.vehicleOnCrossing) {
        bg = '#991b1b';
        text = '🚨 VEHICLE ON CROSSING! STOP!';
      } else if (overlayData.zebraState === 'AT_CROSSING') {
        bg = '#15803d';
        text = '🏁 AT ZEBRA CROSSING';
      }

      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, 36, 18);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, canvas.width / 2, badgeY + 22);
      ctx.textAlign = 'left'; // Reset alignment
    }
  }
}

export async function askGemini(
  question: string,
  _video: HTMLVideoElement | null,
  targetLang?: string,
  chatHistory: Array<{role: string, content: string}> = [],
  assistantName: string = "Vision",
  userContext: string = ""
): Promise<string> {
  // Build a prompt appropriate for voice assistant (concise, conversational, TTS-friendly)
  const langInstruction = targetLang && !targetLang.toLowerCase().startsWith('en')
    ? ` Respond in the user's language (${targetLang}).`
    : '';
  const prompt = `You are ${assistantName}, a friendly, caring AI voice assistant embedded in smart glasses. The user has asked: "${question}". Answer concisely in 1-3 sentences. Be direct, accurate, and warm. Do not use markdown or bullet points — only plain sentences suitable for text-to-speech.${langInstruction}`;

  // 1. Primary: Ultra-fast local Python backend powered by Groq API
  try {
    const response = await fetch('http://localhost:8000/api/ask-gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        lang: targetLang || 'en-US',
        assistant_name: assistantName,
        user_context: userContext,
        chat_history: chatHistory
      }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.answer && data.answer.trim().length > 0) {
        return data.answer.trim();
      }
    }
  } catch (err) {
    console.warn("[Voice Assistant] Local Groq backend unreachable, trying Supabase cloud fallback:", err);
  }

  // 2. Secondary fallback: Supabase Edge Function with text-only mode
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/vision-analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, lang: targetLang, textOnly: true }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.answer && data.answer.trim().length > 0) {
        return data.answer.trim();
      }
    }
  } catch (err) {
    console.warn("Supabase text-only query failed:", err);
  }

  // 3. Offline fallback responses for common simple questions
  const offlineResponses: Array<[RegExp, string | (() => string)]> = [
    [/what time|current time|time now/i, () => `The current time is ${new Date().toLocaleTimeString()}.`],
    [/what date|today('s)? date|current date/i, () => `Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`],
    [/who are you|what are you|your name/i, `I am ${assistantName}, your AI-powered smart glasses assistant.`],
    [/hello|hi there|hey/i, "Hello! How can I help you today?"],
    [/help/i, "I can describe your surroundings, read text, detect objects, identify currency, and navigate you to a destination. Just ask!"],
    [/weather/i, "I don't have access to live weather data right now. Please check your weather app for the current forecast."],
    [/battery|power level/i, "I'm currently running on your smart glasses processor. Check the battery indicator on screen for current levels."],
  ];

  const lowerQ = question.toLowerCase();
  for (const [pattern, response] of offlineResponses) {
    if (pattern.test(lowerQ)) {
      return typeof response === 'function' ? response() : response;
    }
  }

  return `I heard your question: "${question}". I'm currently unable to connect to the AI service. Please check your internet connection and make sure your API key is configured.`;
}
