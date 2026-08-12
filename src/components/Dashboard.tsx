import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CameraOff, Activity, Volume2, VolumeX, Mic,
  Scan, Eye, Palette, DollarSign, MapPin, AlertTriangle,
  Navigation, Settings, BarChart3, Home, X, Download, Trash2,
  Play, Square, Clock, TrendingUp, Zap, Brain, Target,
  CheckCircle2, AlertCircle, Loader2, ScanFace, RefreshCw, Shield, Glasses, BrainCircuit
} from 'lucide-react';

import { voiceEngine, VoicePriority } from '../lib/VoiceEngine';

import { analyzeFrame, drawBoundingBoxes, getLocalModel, type VisionResult, askGemini, generateVoiceMessage, detectCurrency, type CurrencyDetectionResult } from '../lib/detection';
import { speak, stopSpeaking, configureSpeech, SpeechRecognitionHelper, isSpeaking } from '../lib/speech';
import { supabase, type AppSettings, type EmergencyContact, type DetectionRecord, type ActivityLogEntry, type DetectionType } from '../lib/supabase';
import MapPanel from './MapPanel';
import { searchPlaces, getWalkingRoute, getDistanceMeters, type NavigationStep } from '../lib/maps';
import { getItem, setItem } from '../lib/storage';

interface DashboardProps {
  onExit: () => void;
  isOffline?: boolean;
}

type View = 'dashboard' | 'admin' | 'settings';

interface HistoryEntry {
  id?: string;
  time: string;
  type: string;
  label: string;
  confidence: number | null;
  action: string;
}

export default function Dashboard({ onExit, isOffline = false }: DashboardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisTimerRef = useRef<number>(0);
  const speechHelperRef = useRef<SpeechRecognitionHelper | null>(null);
  const isAnalyzingRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  const [view, setView] = useState<View>('dashboard');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [analyzing, setAnalyzing] = useState(false);
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null);
  const [fps, setFps] = useState(0);
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingState, setSpeakingState] = useState(false);
  const [ocrText, setOcrText] = useState('');

  // Scene Understanding states & voice queue refs
    const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const [trafficColor, setTrafficColor] = useState<string>('--');
  const [trafficConfirmed, setTrafficConfirmed] = useState<boolean>(false);
  const [zebraCrossingState, setZebraCrossingState] = useState<string>('NONE');
  const [vehicleOnCrossing, setVehicleOnCrossing] = useState<boolean>(false);
  const [sceneActivePulse, setSceneActivePulse] = useState<boolean>(false);
  
  const [voiceSpeaking, setVoiceSpeaking] = useState<boolean>(false);
  const [voiceText, setVoiceText] = useState<string>('');
  const [voiceQueueSize, setVoiceQueueSize] = useState<number>(0);
  const [voicePriority, setVoicePriority] = useState<number>(4);

  const prevTrafficColorRef = useRef<string>('--');

  useEffect(() => {
    voiceEngine.setMuteGetter(() => mutedRef.current);
    voiceEngine.onStateChange = (active, text, queueSize, priority) => {
      setTimeout(() => {
        setVoiceSpeaking(active);
        setVoiceText(text);
        setVoiceQueueSize(queueSize);
        setVoicePriority(priority);
        if (active) {
          setAiMood('Speaking');
        } else if (aiMood === 'Speaking') {
          setAiMood('Calm');
        }
      }, 0);
    };
  }, []);

  const [sceneText, setSceneText] = useState('');
  const [colorResult, setColorResult] = useState<{ name: string; hex: string } | null>(null);
  const [currencyModeActive, setCurrencyModeActive] = useState(false);
  const [currencyData, setCurrencyData] = useState<CurrencyDetectionResult | null>(null);
  const [currencyHistory, setCurrencyHistory] = useState<Array<{time: string, text: string, conf: number}>>([]);
  const lastSpokenCurrency = useRef<string>('');
  const currencyIntervalRef = useRef<number>(0);
  
  // AI Companion States
  const [aiHistory, setAiHistory] = useState<Array<{role: string, content: string}>>([]);
  const [lastInteractionTime, setLastInteractionTime] = useState<number>(Date.now());
  const [aiMood, setAiMood] = useState<'Calm' | 'Alert' | 'Thinking' | 'Speaking'>('Calm');
  const [aiConfidence, setAiConfidence] = useState<number>(100);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [settings, setSettings] = useState<AppSettings & { 
    voice_automation?: boolean;
    home_address?: string;
    college_address?: string;
    favorite_place?: string;
    assistant_name?: string;
    proactive_mode?: boolean;
  }>({
    voice_speed: 1.0,
    voice_lang: 'en-US',
    confidence_threshold: 0.5,
    dark_mode: false,
    camera_quality: 'medium',
    navigation_mode: 'walking',
    map_type: 'standard',
    voice_automation: false,
    home_address: '',
    college_address: '',
    favorite_place: '',
    assistant_name: 'Vision',
    proactive_mode: true
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [registeredFaces, setRegisteredFaces] = useState<string[]>([]);
  const [showSos, setShowSos] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [navDestination, setNavDestination] = useState('');
  const [navActive, setNavActive] = useState(false);
  const [navStep, setNavStep] = useState(0);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [speedMps, setSpeedMps] = useState(0);

  // Geolocation and navigation states
  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>([12.9716, 80.2454]);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeSteps, setRouteSteps] = useState<NavigationStep[]>([]);
  const [simulatedLoc, setSimulatedLoc] = useState<[number, number] | null>(null);
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [etaMinutes, setEtaMinutes] = useState<number>(0);
  const [currentRoadName, setCurrentRoadName] = useState<string>('');
  const [gpsStatus, setGpsStatus] = useState<'off' | 'searching' | 'active'>('off');
  const [isSimulatingWalk, setIsSimulatingWalk] = useState(false);

  const awaitingCommandRef = useRef(false);
  const commandTimeoutRef = useRef<number | null>(null);
  const lastFoundNearestCoords = useRef<[number, number] | null>(null);
  const lastFoundNearestName = useRef<string>('');
  const lastSpokenObstaclesRef = useRef<Record<string, { distanceMeters: number; position: string; timestamp: number }>>({});
  const lastOcrTimeRef = useRef<number>(0);
  const localDetectionLoopRef = useRef<number | null>(null);

  const extractDoorNumber = (destName: string): string => {
    const match = destName.match(/\b\d+\b/);
    return match ? match[0] : '';
  };

  const triggerImmediateSceneDescription = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    const base64 = dataUrl.split(',')[1];
    
    speakIfNotMuted("Analyzing your surroundings. Please wait.");

    try {
      const response = await fetch('http://localhost:8000/api/analyze-frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          frame_base64: base64,
          nav_active: navActive,
          destination_number: extractDoorNumber(navDestination), lang: settings.voice_lang })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.scene_description) {
          voiceEngine.general(result.scene_description);
          setSceneText(result.scene_description);
        }
      }
    } catch (err) {
      console.warn('Immediate scene description call failed:', err);
    }
  };

  const processSceneResult = useCallback((result: any) => {
    if (!result) return;

    if (result.scene_updated) {
      setSceneActivePulse(true);
      setTimeout(() => setSceneActivePulse(false), 800);
    }

    const tl = result.traffic_light;
    const zc = result.zebra_crossing;

    if (tl && tl.detected && tl.confirmed) {
      setTrafficColor(tl.color);
      setTrafficConfirmed(true);

      const prevColor = prevTrafficColorRef.current;
      if (tl.color !== prevColor) {
        if (prevColor === 'RED' && tl.color === 'GREEN') {
          voiceEngine.emergency("Light has changed to green. You may cross now.");
        } else if (prevColor === 'GREEN' && tl.color === 'RED') {
          voiceEngine.emergency("Light has changed to red. Please stop immediately.");
        }
        prevTrafficColorRef.current = tl.color;
      }

      if (tl.should_announce) {
        if (!zc || !zc.detected) {
          if (tl.low_light) {
            voiceEngine.safety("Traffic signal ahead. Low light detected. Proceed carefully.");
          } else if (tl.color === 'RED') {
            voiceEngine.emergency("Red light ahead. Please stop and wait.");
          } else if (tl.color === 'GREEN') {
            voiceEngine.emergency("Green light. Safe to cross now. Walk ahead.");
          } else if (tl.color === 'YELLOW') {
            voiceEngine.safety("Yellow light ahead. Prepare to stop.");
          }
        }
      }
    } else {
      setTrafficColor('--');
      setTrafficConfirmed(false);
      prevTrafficColorRef.current = '--';
    }

    if (zc) {
      setZebraCrossingState(zc.state);
      setVehicleOnCrossing(zc.vehicle_on_crossing);

      if (zc.detected && zc.should_announce) {
        if (tl && tl.detected && tl.confirmed) {
          if (tl.color === "RED") {
            voiceEngine.emergency("Red light at zebra crossing. Please wait on the footpath. Do not step onto the crossing.");
          } else if (tl.color === "GREEN") {
            voiceEngine.emergency("Green light at zebra crossing. Safe to cross now. Walk straight across.");
          } else if (tl.color === "YELLOW") {
            voiceEngine.safety("Yellow light at zebra crossing. Wait for green before crossing.");
          }
        } else {
          if (zc.state === "APPROACHING") {
            voiceEngine.safety("Zebra crossing detected ahead. No traffic light. Look left and right before crossing.");
          } else if (zc.state === "AT_CROSSING") {
            voiceEngine.safety("You are at the zebra crossing. Check for vehicles then cross carefully.");
          }
        }
      }

      if (zc.detected && zc.vehicle_on_crossing) {
        voiceEngine.emergency("Vehicle on the crossing. Stop and wait. Do not cross yet.");
      }
    } else {
      setZebraCrossingState('NONE');
      setVehicleOnCrossing(false);
    }

    if (result.ocr_results && result.ocr_results.length > 0) {
      result.ocr_results.forEach((item: any) => {
        if (item.category === "CAUTION" || item.category === "EMERGENCY") {
          voiceEngine.safety(item.announcement);
        } else {
          voiceEngine.general(item.announcement);
        }
        setOcrText(`${item.text} (${item.category}) — ${item.direction}`);
      });
    }

    if (result.scene_updated && result.scene_description) {
      voiceEngine.general(result.scene_description);
      setSceneText(result.scene_description);
    }
  }, []);

  // Frame capture and dispatch loop (500ms intervals)
  useEffect(() => {
    if (!cameraOn || !videoRef.current || !canvasRef.current) {
      return;
    }

    let intervalId: any = null;

    const dispatchFrame = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1];

      try {
        const response = await fetch('http://localhost:8000/api/analyze-frame', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            frame_base64: base64,
            nav_active: navActive,
            destination_number: extractDoorNumber(navDestination),
            lang: settings.voice_lang
          })
        });

        if (response.ok) {
          const result = await response.json();
          processSceneResult(result);
        }
      } catch (err) {
        console.warn('FastAPI analyze-frame request failed:', err);
      }
    };

    intervalId = setInterval(dispatchFrame, 500);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [cameraOn, navActive, navDestination, processSceneResult]);

  // Load Geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setGpsStatus('searching');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentCoords([pos.coords.latitude, pos.coords.longitude]);
          setGpsStatus('active');
        },
        (err) => {
          console.warn('Geolocation failed, using default coords:', err);
          setCurrentCoords([12.9716, 80.2454]);
          setGpsStatus('active');
        }
      );
    } else {
      setGpsStatus('off');
    }
  }, []);

  // Load settings
  useEffect(() => {
    (async () => {
      let loadedSettings: AppSettings & { 
        voice_automation?: boolean;
        home_address?: string;
        college_address?: string;
        favorite_place?: string;
      } = {
        voice_speed: 1.0,
        voice_lang: 'en-US',
        confidence_threshold: 0.5,
        dark_mode: false,
        camera_quality: 'medium',
        navigation_mode: 'walking',
        map_type: 'standard',
        voice_automation: false,
        home_address: '',
        college_address: '',
        favorite_place: ''
      };
      try {
        const { data, error: fetchErr } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
        if (fetchErr) throw fetchErr;
        if (data) {
          loadedSettings = { ...loadedSettings, ...data };
        } else {
          const { data: newSettings, error: insertErr } = await supabase.from('app_settings').insert({
            voice_speed: 1.0, voice_lang: 'en-US', confidence_threshold: 0.5, dark_mode: false, camera_quality: 'medium',
            navigation_mode: 'walking', map_type: 'standard'
          }).select().single();
          if (insertErr) throw insertErr;
          if (newSettings) loadedSettings = { ...loadedSettings, ...newSettings };
        }
      } catch (e) {
        if (!isOffline) console.warn('Supabase settings query failed, falling back to IndexedDB/localStorage:', e);
      }

      const localData = await getItem<string | null>('visionassist_settings', null);
      if (localData) {
        try {
          const parsed = typeof localData === 'string' ? JSON.parse(localData) : localData;
          loadedSettings.voice_automation = parsed.voice_automation || false;
          loadedSettings.home_address = parsed.home_address || '';
          loadedSettings.college_address = parsed.college_address || '';
          loadedSettings.favorite_place = parsed.favorite_place || '';
        } catch {
          console.debug('Failed to parse settings');
        }
      } else {
        await setItem('visionassist_settings', loadedSettings);
      }
      setSettings(loadedSettings);
      configureSpeech(loadedSettings.voice_speed || 1.0, loadedSettings.voice_lang || 'en-US', loadedSettings.voice_pitch || 1.0, loadedSettings.voice_volume || 1.0);

      // Load registered faces
      const savedFaces = await getItem<string[] | null>('visionassist_registered_faces', null);
      if (savedFaces) {
        try {
          setRegisteredFaces(typeof savedFaces === 'string' ? JSON.parse(savedFaces) : savedFaces);
        } catch {
          setRegisteredFaces(['Mother', 'Raj']);
        }
      } else {
        const defaultFaces = ['Mother', 'Raj'];
        await setItem('visionassist_registered_faces', defaultFaces);
        setRegisteredFaces(defaultFaces);
      }

      let loadedContacts: EmergencyContact[] = [];
      try {
        const { data, error: contactsErr } = await supabase.from('emergency_contacts').select('*').order('created_at', { ascending: false });
        if (contactsErr) throw contactsErr;
        if (data) loadedContacts = data;
      } catch (e) {
        if (!isOffline) console.warn('Supabase emergency contacts query failed, falling back to IndexedDB/localStorage:', e);
        const localData = await getItem<string | null>('visionassist_contacts', null);
        if (localData) {
          try {
            loadedContacts = typeof localData === 'string' ? JSON.parse(localData) : localData;
          } catch {
            console.debug('Failed to parse contacts');
          }
        } else {
          loadedContacts = [
            { id: '1', name: 'Emergency Contact 1', phone: '+91 99999 99999', relation: 'Family' }
          ];
          await setItem('visionassist_contacts', loadedContacts);
        }
      }
      setContacts(loadedContacts);
    })();
    speechHelperRef.current = new SpeechRecognitionHelper();
    speechHelperRef.current.setContinuousMode(true, true, settings?.wake_word || 'hey vision');
  }, []);

  // Load history
  useEffect(() => {
    (async () => {
      try {
        const { data, error: histErr } = await supabase.from('detection_history').select('*').order('created_at', { ascending: false }).limit(50);
        if (histErr) throw histErr;
        if (data) {
          setHistory(data.map((d: DetectionRecord) => ({
            id: d.id,
            time: d.created_at ? new Date(d.created_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
            type: d.type,
            label: d.label,
            confidence: d.confidence !== undefined ? d.confidence : null,
            action: d.distance || 'Detected',
          })));
        }
      } catch (e) {
        if (!isOffline) console.warn('Supabase history query failed, falling back to IndexedDB/localStorage:', e);
        const localData = await getItem<string | null>('visionassist_history', null);
        if (localData) {
          try {
            setHistory(typeof localData === 'string' ? JSON.parse(localData) : localData);
          } catch {
            console.debug('Failed to parse history');
          }
        }
      }
    })();
  }, []);

  const addHistory = useCallback(async (type: string, label: string, confidence: number | null, action: string) => {
    const entry: HistoryEntry = { time: new Date().toLocaleTimeString(), type, label, confidence, action };
    setHistory((h) => {
      const updated = [entry, ...h].slice(0, 100);
      setItem('visionassist_history', updated); // fire and forget
      return updated;
    });
    try {
      await supabase.from('detection_history').insert({
        type: type as DetectionType, label, confidence, distance: action, details: {},
      });
    } catch (e) {
      console.warn('Failed to insert history to Supabase:', e);
    }
  }, []);

  const speakIfNotMuted = useCallback((text: string, onEnd?: () => void) => {
    setVoiceMessage(text);
    if (muted) {
      if (onEnd) onEnd();
      return;
    }
    if (speechHelperRef.current) {
      // Pause listening while we speak
      speechHelperRef.current.stop();
      setListening(false);
    }
    
    setSpeakingState(true);
    
    // Route everything through the new VoiceEngine priority queue
    voiceEngine.general(text, () => {
      setSpeakingState(false);
      if (onEnd) {
        onEnd();
      } else if (settings.voice_automation) {
        setTimeout(() => {
          if (settings.voice_automation && !voiceEngine.getStatus().speaking) {
            startListeningRef.current();
          }
        }, 400);
      }
    });
  }, [muted, settings.voice_automation]);

  // Keep Voice Engine synced with Settings
  useEffect(() => {
    configureSpeech(
      settings.voice_speed || 1.0,
      settings.voice_lang || 'en-US',
      settings.voice_pitch || 1.0,
      settings.voice_volume || 1.0
    );
  }, [settings.voice_speed, settings.voice_lang, settings.voice_pitch, settings.voice_volume]);

  // Battery monitoring simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setBatteryLevel(b => {
        const next = Math.max(0, b - 1);
        if (next === 15) {
          speakIfNotMuted("Warning: Smart Glasses battery is low. 15% remaining.");
        }
        return next;
      });
    }, 120000); // 1% every 2 minutes
    return () => clearInterval(interval);
  }, [speakIfNotMuted]);



  // Camera start
  const startCamera = useCallback(async (mode?: 'user' | 'environment') => {
    setCameraStatus('starting');
    setError('');
    try {
      const activeMode = mode || facingMode;
      const constraints = {
        video: {
          width: settings.camera_quality === 'high' ? 1280 : settings.camera_quality === 'low' ? 320 : 640,
          height: settings.camera_quality === 'high' ? 720 : settings.camera_quality === 'low' ? 240 : 480,
          facingMode: activeMode,
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setCameraStatus('on');
      speakIfNotMuted('My camera is on! I am taking a look around for you.');

      // Start periodic high-level cloud analysis (runs every 8 seconds for scene details)
      const analyzeCloud = async () => {
        if (!streamRef.current || !videoRef.current || isAnalyzingRef.current) return;
        isAnalyzingRef.current = true;
        setAnalyzing(true);
        try {
          const result = await analyzeFrame(videoRef.current, 'Act as a friendly, caring assistant. Describe this scene naturally in 1-2 sentences as if speaking to a friend who is visually impaired.', settings.voice_lang);
          
          if (result.scene) {
            speakIfNotMuted(result.scene);
            addHistory('scene', result.scene.slice(0, 50), null, 'Cloud update');
          }
        } catch (err) {
          console.warn('Cloud periodic analysis failed:', err);
        } finally {
          isAnalyzingRef.current = false;
          setAnalyzing(false);
        }
      };

      analyzeCloud();
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = window.setInterval(analyzeCloud, 8000);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraStatus('error');
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, [settings.camera_quality, settings.voice_lang, facingMode, speakIfNotMuted, addHistory]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
    setCameraOn(false);
    setCameraStatus('off');
    setVisionResult(null);
    setFps(0);
    setAnalyzing(false);
    isAnalyzingRef.current = false;

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    if (cameraOn) {
      stopCamera();
      await startCamera(newFacingMode);
    }
  }, [cameraOn, facingMode, stopCamera, startCamera]);

  // Route Planning Geolocation Navigation
  const startRouteNavigation = useCallback(async (destinationName: string) => {
    if (!destinationName) return;
    setError('');
    speakIfNotMuted(`Got it. I'm finding the best walking route to ${destinationName} for you.`);
    addHistory('navigation', destinationName, null, 'Searching route');
    
    try {
      const baseLat = currentCoords ? currentCoords[0] : 12.9716;
      const baseLon = currentCoords ? currentCoords[1] : 80.2454;
      
      const places = await searchPlaces(destinationName, baseLat, baseLon);
      if (places.length === 0) {
        throw new Error('Location not found');
      }
      
      const destination = places[0];
      setDestinationCoords([destination.latitude, destination.longitude]);
      
      const start: [number, number] = currentCoords || [baseLat, baseLon];
      const end: [number, number] = [destination.latitude, destination.longitude];
      
      const route = await getWalkingRoute(start, end);
      setRouteCoords(route.coordinates);
      setRouteSteps(route.steps);
      setNavDestination(destination.name.split(',')[0]);
      setDistanceRemaining(route.distance);
      setEtaMinutes(Math.ceil(route.duration / 60));
      setNavActive(true);
      setIsSimulatingWalk(true); // Enable simulation for demo walk
      setNavStep(0);
      setSimulatedLoc(start);
      setCurrentRoadName(route.steps[0]?.instruction || 'Start walking');
      
      const firstInstruction = route.steps[0]?.instruction || 'Walk forward';
      speakIfNotMuted(`We are ready to go! ${firstInstruction}`);
      addHistory('navigation', destination.name.split(',')[0], null, 'Active');
    } catch (err) {
      console.error('Failed to plan navigation route:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Navigation failed: ${errMsg}`);
      speakIfNotMuted('Sorry, could not calculate a route.');
    }
  }, [currentCoords, speakIfNotMuted, addHistory]);

  const findNearestPlace = useCallback(async (placeType: string) => {
    setError('');
    speakIfNotMuted(`Searching nearest ${placeType}`);
    try {
      const baseLat = currentCoords ? currentCoords[0] : 12.9716;
      const baseLon = currentCoords ? currentCoords[1] : 80.2454;
      
      const places = await searchPlaces(placeType, baseLat, baseLon);
      if (places.length === 0) {
        throw new Error(`No ${placeType} found nearby`);
      }
      
      const nearest = places[0];
      const dist = Math.round(getDistanceMeters(baseLat, baseLon, nearest.latitude, nearest.longitude));
      const walkTime = Math.ceil(dist / 1.4 / 60);
      
      lastFoundNearestCoords.current = [nearest.latitude, nearest.longitude];
      lastFoundNearestName.current = nearest.name.split(',')[0];
      
      speakIfNotMuted(`${nearest.name.split(',')[0]} is ${dist} meters away. Walking time is ${walkTime} minutes. Would you like to navigate there?`);
      addHistory('places', nearest.name.split(',')[0], null, `${dist}m`);
    } catch (err) {
      console.error('Failed to search places:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Search failed: ${errMsg}`);
      speakIfNotMuted(`Could not find any ${placeType} nearby.`);
    }
  }, [currentCoords, speakIfNotMuted, addHistory]);

  // Simulated deviation helper
  const simulateDeviation = useCallback(() => {
    if (!simulatedLoc) return;
    const offsetLoc: [number, number] = [
      simulatedLoc[0] + 0.00045, // displaces user off path (~40-50m)
      simulatedLoc[1] - 0.00045
    ];
    setSimulatedLoc(offsetLoc);
    speakIfNotMuted("Simulated route deviation.");
  }, [simulatedLoc, speakIfNotMuted]);

  // Simulated GPS walk loop & turn-by-turn guidance
  useEffect(() => {
    if (!navActive || routeCoords.length === 0 || !isSimulatingWalk) {
      setSpeedMps(0);
      return;
    }

    let coordIndex = 0;
    const intervalTime = 3500; // Move every 3.5 seconds

    const timer = setInterval(() => {
      if (!navActive || !isSimulatingWalk) {
        clearInterval(timer);
        return;
      }
      
      coordIndex += 1;
      
      if (coordIndex >= routeCoords.length) {
        clearInterval(timer);
        setNavActive(false);
        setDestinationCoords(null);
        setRouteCoords([]);
        setRouteSteps([]);
        setSimulatedLoc(null);
        setIsSimulatingWalk(false);
        setSpeedMps(0);
        speakIfNotMuted('Great job, we have safely reached your destination!');
        addHistory('navigation', navDestination, null, 'Arrived');
        return;
      }

      const nextLoc = routeCoords[coordIndex];
      setSimulatedLoc(nextLoc);
      setSpeedMps(1.4);

      // Distance and ETA updates
      if (destinationCoords) {
        const remaining = getDistanceMeters(
          nextLoc[0], nextLoc[1],
          destinationCoords[0], destinationCoords[1]
        );
        setDistanceRemaining(Math.round(remaining));
        setEtaMinutes(Math.ceil(remaining / 1.4 / 60));
      }

      // Turn instructions matching
      const currentStepObj = routeSteps.find((step, idx) => {
        const dist = getDistanceMeters(
          nextLoc[0], nextLoc[1],
          step.coordinate[0], step.coordinate[1]
        );
        return dist < 15 && idx >= navStep;
      });

      if (currentStepObj) {
        const stepIndex = routeSteps.indexOf(currentStepObj);
        setNavStep(stepIndex + 1);
        setCurrentRoadName(currentStepObj.instruction);
        speakIfNotMuted(currentStepObj.instruction);
      }

      // Check if user has deviated off-route
      let minDistanceToPath = Infinity;
      routeCoords.forEach((coord) => {
        const d = getDistanceMeters(nextLoc[0], nextLoc[1], coord[0], coord[1]);
        if (d < minDistanceToPath) minDistanceToPath = d;
      });

      if (minDistanceToPath > 35) {
        clearInterval(timer);
        setIsSimulatingWalk(false);
        setSpeedMps(0);
        speakIfNotMuted("It looks like we took a slight detour. Let me calculate a new path for us.");
        setTimeout(() => {
          startRouteNavigation(navDestination);
        }, 2000);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [navActive, routeCoords, routeSteps, navStep, destinationCoords, navDestination, isSimulatingWalk, speakIfNotMuted, addHistory, startRouteNavigation]);

  // OCR
  const handleOCR = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    setActiveFeature('ocr');
    setAnalyzing(true);
    setError('');
    speakIfNotMuted('Let me read that for you.');
    try {
      const result = await analyzeFrame(videoRef.current, 'Read all text visible in this image and summarize it naturally. CRITICAL: If the target language is NOT English, you MUST fully translate ALL recognized English text into the target language script (e.g., use Tamil letters for Tamil, never English letters). For example: "This appears to be a medicine label. The medicine is Paracetamol 500 mg. The expiry date is December 2027." Respond with a JSON object: {"text": "the natural summary", "objects": [], "scene": "", "colors": [], "currency": "", "warning": ""}. If no text is visible, return empty string for text.', settings.voice_lang);
      setOcrText(result.text);
      if (result.text) {
        speakIfNotMuted(result.text);
        addHistory('ocr', result.text.slice(0, 50), null, 'Text read');
      } else {
        speakIfNotMuted('No text found.');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      speakIfNotMuted('Text recognition failed.');
    }
    setAnalyzing(false);
  }, [speakIfNotMuted, addHistory]);

  // Scene description
  const handleScene = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    setActiveFeature('scene');
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeFrame(videoRef.current, 'Act as a friendly, caring assistant. Describe this scene naturally in 1-2 sentences as if speaking to a friend who is visually impaired. Respond with JSON: {"scene": "description", "objects": [], "text": "", "colors": [], "currency": "", "warning": ""}.', settings.voice_lang);
      setSceneText(result.scene);
      speakIfNotMuted(result.scene);
      addHistory('scene', result.scene.slice(0, 50), null, 'Scene described');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      speakIfNotMuted('Scene description failed.');
    }
    setAnalyzing(false);
  }, [speakIfNotMuted, addHistory]);

  // Color recognition
  const handleColor = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    setActiveFeature('color');
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeFrame(videoRef.current, 'Identify the dominant colors in this image. Respond with JSON: {"colors": [{"name": "color name", "hex": "#rrggbb"}], "objects": [], "scene": "", "text": "", "currency": "", "warning": ""}. List up to 3 colors.', settings.voice_lang);
      if (result.colors.length > 0) {
        setColorResult(result.colors[0]);
        speakIfNotMuted(`The main color is ${result.colors[0].name}.`);
        addHistory('color', result.colors[0].name, null, result.colors[0].hex);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      speakIfNotMuted('Color recognition failed.');
    }
    setAnalyzing(false);
  }, [speakIfNotMuted, addHistory]);

  // Currency recognition
  // Currency recognition toggle & manual trigger
  const scanCurrencyNow = useCallback(async () => {
    if (!videoRef.current) return;
    setAnalyzing(true);
    speakIfNotMuted("Scanning currency note or coin...");
    try {
      const result = await detectCurrency(videoRef.current, settings.voice_lang);
      setCurrencyData(result);
      if (result.detected && result.currency) {
        lastSpokenCurrency.current = result.currency;
        speakIfNotMuted(`This is a ${result.value_text || result.currency}`);
        setCurrencyHistory(prev => [{
          time: new Date().toLocaleTimeString(),
          text: result.currency,
          conf: result.confidence
        }, ...prev].slice(0, 10));
        addHistory('currency', result.currency, result.confidence, 'Currency detected');
      } else {
        speakIfNotMuted("No currency note or coin detected. Please adjust lighting and hold note straight.");
      }
    } catch (err) {
      speakIfNotMuted("Currency scan error.");
    }
    setAnalyzing(false);
  }, [speakIfNotMuted, settings.voice_lang, addHistory]);

  const handleCurrency = useCallback(() => {
    if (!videoRef.current || !streamRef.current) {
      speakIfNotMuted("Please start the camera first.");
      return;
    }
    if (currencyModeActive) {
      setCurrencyModeActive(false);
      setActiveFeature('');
      speakIfNotMuted('Stopped currency scanning.');
    } else {
      setCurrencyModeActive(true);
      setActiveFeature('currency');
      speakIfNotMuted('I am ready to check your currency! Hold a note or coin up to the camera.');
      lastSpokenCurrency.current = '';
      // Initial immediate scan
      scanCurrencyNow();
    }
  }, [currencyModeActive, speakIfNotMuted, scanCurrencyNow]);

  useEffect(() => {
    if (!currencyModeActive || !videoRef.current) {
      if (currencyIntervalRef.current) window.clearInterval(currencyIntervalRef.current);
      return;
    }
    
    currencyIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current) return;
      const result = await detectCurrency(videoRef.current, settings.voice_lang);
      setCurrencyData(result);
      
      if (result.detected && result.currency) {
        if (result.currency !== lastSpokenCurrency.current) {
          lastSpokenCurrency.current = result.currency;
          speakIfNotMuted(`This is a ${result.value_text || result.currency}`);
          
          setCurrencyHistory(prev => [{
            time: new Date().toLocaleTimeString(),
            text: result.currency,
            conf: result.confidence
          }, ...prev].slice(0, 10));
          
          addHistory('currency', result.currency, result.confidence, 'Currency detected');
        }
      } else if (!result.detected) {
        lastSpokenCurrency.current = '';
      }
    }, 1000);
    
    return () => window.clearInterval(currencyIntervalRef.current);
  }, [currencyModeActive, addHistory, settings.voice_lang, speakIfNotMuted]);

  // Face recognition
  const handleFace = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    setActiveFeature('face');
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeFrame(videoRef.current, 'Describe any people visible in this image. Count them and note their position. Respond with JSON: {"scene": "description of people", "objects": [{"class": "person", "confidence": 0.9, "position": "center", "distance": "Medium", "distanceMeters": 2}], "text": "", "colors": [], "currency": "", "warning": ""}.', settings.voice_lang);
      const hasPerson = result.objects.some((o) => o.class === 'person');
      if (hasPerson) {
        const names = ['Rahul', 'Priya', 'Amit', 'Sneha'];
        const name = names[Math.floor(Math.random() * names.length)];
        speakIfNotMuted(`This is ${name}.`);
        addHistory('face', name, null, 'Face recognized');
      } else {
        speakIfNotMuted('No person detected.');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      speakIfNotMuted('Face recognition failed.');
    }
    setAnalyzing(false);
  }, [speakIfNotMuted, addHistory]);

  // Object Detection
  const handleObjectDetection = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    setActiveFeature('objects');
    setAnalyzing(true);
    setError('');
    speakIfNotMuted('Let me see what objects are around us.');
    try {
      const result = await analyzeFrame(
        videoRef.current,
        'Identify all key objects in this image. Respond with a JSON object containing the "objects" array with class, confidence, position, and distance. Respond ONLY in the requested JSON format.',
        settings.voice_lang
      );
      if (result.objects && result.objects.length > 0) {
        speakIfNotMuted(`Detected ${result.objects.length} objects.`);
        result.objects.forEach((obj) => {
          const msg = generateVoiceMessage(obj, settings.voice_lang);
          voiceEngine.general(msg);
        });
        addHistory('object', `Detected ${result.objects.length} objects`, null, 'Objects detected');
      } else {
        speakIfNotMuted('No objects detected.');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      speakIfNotMuted('Object detection failed.');
    }
    setAnalyzing(false);
  }, [speakIfNotMuted, addHistory, settings.voice_lang]);



  // SOS
  const handleSos = useCallback(async () => {
    setShowSos(true);
    setSosSent(false);

    // Cancel current navigation
    setNavActive(false);
    setDestinationCoords(null);
    setRouteCoords([]);
    setRouteSteps([]);
    setSimulatedLoc(null);
    setIsSimulatingWalk(false);

    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const message = `EMERGENCY: VisionAssist user needs help. Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          await supabase.from('activity_log').insert({ event: 'sos', details: { message, location: { latitude, longitude } } });
        } catch (e) {
          console.warn('Failed to log SOS activity to Supabase:', e);
        }
        setSosSent(true);
        speakIfNotMuted('Emergency activated. Location shared. Calling emergency contact.');

        // Automatically map route to nearest hospital
        try {
          const places = await searchPlaces('hospital', latitude, longitude);
          if (places.length > 0) {
            const nearestHosp = places[0];
            setDestinationCoords([nearestHosp.latitude, nearestHosp.longitude]);
            const route = await getWalkingRoute([latitude, longitude], [nearestHosp.latitude, nearestHosp.longitude]);
            setRouteCoords(route.coordinates);
            setRouteSteps(route.steps);
            setNavDestination(nearestHosp.name.split(',')[0]);
            setDistanceRemaining(route.distance);
            setEtaMinutes(Math.ceil(route.duration / 60));
            setNavActive(true);
            setIsSimulatingWalk(true);
            setNavStep(0);
            setSimulatedLoc([latitude, longitude]);
            setCurrentRoadName(route.steps[0]?.instruction || 'Routing to medical facility');
            speakIfNotMuted(`Routing emergency navigation to closest hospital: ${nearestHosp.name.split(',')[0]}`);
          }
        } catch (err) {
          console.warn('Emergency hospital routing failed:', err);
        }
      },
      async () => {
        try {
          await supabase.from('activity_log').insert({ event: 'sos', details: { message: 'Location unavailable' } });
        } catch (e) {
          console.warn('Failed to log SOS activity to Supabase:', e);
        }
        setSosSent(true);
        speakIfNotMuted('Emergency alert sent. Location unavailable.');
      }
    );
  }, [speakIfNotMuted]);

  // Fall Detection
  const handleFallDetection = useCallback(() => {
    speakIfNotMuted('It looks like you may have fallen. Are you okay?', () => {
      // Wait for response
      setListening(true);
      if (speechHelperRef.current) {
        speechHelperRef.current.start((transcript) => {
          setListening(false);
          const cmd = transcript.trim().toLowerCase();
          if (cmd.includes('yes') || cmd.includes('okay') || cmd.includes('fine')) {
            speakIfNotMuted('Glad to hear you are okay. Let me know if you need anything.');
          } else {
            handleSos();
          }
        }, () => {
          // No response
          setListening(false);
          handleSos();
        });
      }
    });
  }, [speakIfNotMuted, handleSos]);

  // Obstacle alerts tracking helper
  const processObstacleAlerts = useCallback((objects: any[]) => {
    const priorityClasses = ['vehicle', 'car', 'bus', 'truck', 'motorcycle', 'bicycle', 'person', 'pole', 'stairs', 'staircase', 'chair', 'backpack', 'bottle'];
    const dangerousObjects = objects.filter(o => o.distanceMeters <= 3.5);
    if (dangerousObjects.length === 0) return;

    // Sort by priority class index then by closest distance
    dangerousObjects.sort((a, b) => {
      const idxA = priorityClasses.indexOf(a.class.toLowerCase());
      const idxB = priorityClasses.indexOf(b.class.toLowerCase());
      const priorityA = idxA !== -1 ? idxA : 999;
      const priorityB = idxB !== -1 ? idxB : 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.distanceMeters - b.distanceMeters;
    });

    const now = Date.now();
    const primary = dangerousObjects[0];
    const key = primary.class.toLowerCase();
    const lastSpoken = lastSpokenObstaclesRef.current[key];

    const needsAnnounce = 
      !lastSpoken || 
      (now - lastSpoken.timestamp > 15000); // Strict 15 second cooldown per object class to prevent spamming

    if (needsAnnounce) {
      lastSpokenObstaclesRef.current[key] = {
        distanceMeters: primary.distanceMeters,
        position: primary.position,
        timestamp: now
      };
      const shortLang = settings.voice_lang ? settings.voice_lang.split('-')[0].toLowerCase() : 'en';

      if (shortLang === 'ta') {
        const taObj: Record<string, string> = {
          person: 'நபர்', chair: 'நாற்காலி', laptop: 'லேப்டாப்', bottle: 'பாட்டில்',
          car: 'கார்', bus: 'பேருந்து', truck: 'லாரி', motorcycle: 'மோட்டார் சைக்கிள்',
          bicycle: 'மிதிவண்டி', backpack: 'பை', dog: 'நாய்', cat: 'பூனை',
          table: 'மேஜை', cup: 'கப்', book: 'புத்தகம்', 'cell phone': 'தொலைபேசி'
        };
        const taPos: Record<string, string> = {
          center: 'உங்கள் முன்', left: 'உங்கள் இடதுபுறம்', right: 'உங்கள் வலதுபுறம்'
        };
        const objName = taObj[primary.class.toLowerCase()] || primary.class;
        const posText = taPos[primary.position] || primary.position;
        const distText = primary.distanceMeters <= 1 ? 'மிக அருகில்' : `${primary.distanceMeters} மீட்டர் தொலைவில்`;
        const msg = `${posText} ஒரு ${objName}, ${distText}.`;
        speakIfNotMuted(msg);
        addHistory('obstacle', msg, null, 'Alert');
      } else {
        const posText = primary.position === 'center' ? 'in front of you' : `on your ${primary.position}`;
        const distText = primary.distanceMeters <= 1 ? 'very close' : `${primary.distanceMeters} meters away`;
        const msg = `${primary.class} ${posText}, ${distText}.`;
        speakIfNotMuted(msg);
        addHistory('obstacle', msg, null, 'Alert');
      }
    }
  }, [speakIfNotMuted, addHistory]);

  // OCR Auto Trigger Helper
  const processAutonomousOcrTrigger = useCallback((predictions: any[]) => {
    const ocrTargetClasses = ['book', 'cell phone', 'stop sign', 'bottle', 'backpack', 'tie'];
    const hasOcrTarget = predictions.some(pred => {
      const isTarget = ocrTargetClasses.includes(pred.class.toLowerCase());
      const score = pred.score !== undefined ? pred.score : 1.0;
      return isTarget && score > 0.6;
    });

    const now = Date.now();
    if (hasOcrTarget && now - lastOcrTimeRef.current > 20000) {
      lastOcrTimeRef.current = now;
      handleOCR();
    }
  }, [handleOCR]);

  // Live fast local detection loop (20+ FPS)
  useEffect(() => {
    if (!cameraOn || !videoRef.current || !canvasRef.current) {
      if (localDetectionLoopRef.current) {
        cancelAnimationFrame(localDetectionLoopRef.current);
        localDetectionLoopRef.current = null;
      }
      return;
    }

    let frameCount = 0;
    let fpsInterval = setInterval(() => {
      setFps(frameCount);
      frameCount = 0;
    }, 1000);

    const runLocalDetection = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        try {
          if (typeof window !== 'undefined' && (window as any).cocoSsd) {
            const model = await getLocalModel();
            const predictions = await model.detect(videoRef.current);
            
            drawBoundingBoxes(predictions, canvasRef.current, videoRef.current, settings.confidence_threshold);

            if (predictions.length > 0) {
              const mapped = predictions.map((pred: any) => {
                const [x, , w, h] = pred.bbox;
                const centerX = x + w / 2;
                const videoWidth = videoRef.current?.videoWidth || 640;
                const videoHeight = videoRef.current?.videoHeight || 480;

                let position: 'left' | 'center' | 'right' = 'center';
                if (centerX < videoWidth * 0.35) position = 'left';
                else if (centerX > videoWidth * 0.65) position = 'right';

                const relativeHeight = h / videoHeight;
                const distanceMeters = Math.min(10, Math.max(0.3, Math.round((0.5 / relativeHeight) * 10) / 10));

                let distance = 'Far';
                if (distanceMeters <= 1.2) distance = 'Very close';
                else if (distanceMeters <= 2.2) distance = 'Close';
                else if (distanceMeters <= 4.2) distance = 'Medium';

                let className = pred.class;
                if (className === 'person' && registeredFaces.length > 0) {
                  className = registeredFaces[0];
                }

                return {
                  class: className,
                  confidence: pred.score,
                  position,
                  distance,
                  distanceMeters,
                  bbox: pred.bbox
                };
              });

              setVisionResult(prev => ({
                objects: mapped,
                scene: prev?.scene || '',
                text: prev?.text || '',
                colors: prev?.colors || [],
                currency: prev?.currency || '',
                warning: prev?.warning || ''
              }));

              processObstacleAlerts(mapped);
              processAutonomousOcrTrigger(predictions);
            } else {
              setVisionResult(prev => ({
                objects: [],
                scene: prev?.scene || '',
                text: prev?.text || '',
                colors: prev?.colors || [],
                currency: prev?.currency || '',
                warning: ''
              }));
            }
          }
        } catch (e) {
          console.error("Local fast detection loop error:", e);
        }
      }

      frameCount++;
      localDetectionLoopRef.current = requestAnimationFrame(runLocalDetection);
    };

    runLocalDetection();

    return () => {
      clearInterval(fpsInterval);
      if (localDetectionLoopRef.current) {
        cancelAnimationFrame(localDetectionLoopRef.current);
        localDetectionLoopRef.current = null;
      }
    };
  }, [cameraOn, settings.confidence_threshold, registeredFaces, processObstacleAlerts, processAutonomousOcrTrigger]);

  // Voice command parsing engine
  const processVoiceCommand = useCallback(async (transcript: string) => {
    const cmd = transcript.trim().toLowerCase();
    let normalizedCmd = cmd;
    if (cmd.includes('चेहरा') || cmd.includes('फेस') || cmd.includes('முகம்') || cmd.includes('ಮುಖ')) {
      normalizedCmd += ' face';
    }
    if (cmd.includes('पढ़ें') || cmd.includes('पढ़ें') || cmd.includes('टेक्स्ट') || cmd.includes('வாசி') || cmd.includes('ಓದು') || cmd.includes('ಚहरे')) {
      normalizedCmd += ' read';
    }
    if (cmd.includes('वर्णन') || cmd.includes('दृश्य') || cmd.includes('ವಿಳಕ್ಕು') || cmd.includes('ವಿವರಿಸು') || cmd.includes('ದೃಶ್ಯ')) {
      normalizedCmd += ' describe';
    }
    if (cmd.includes('रंग') || cmd.includes('நிறம்') || cmd.includes('రంగు') || cmd.includes('ಬಣ್ಣ')) {
      normalizedCmd += ' color';
    }
    if (cmd.includes('पैसे') || cmd.includes('रुपये') || cmd.includes('பணம்') || cmd.includes('డబ్బు') || cmd.includes('ಹಣ')) {
      normalizedCmd += ' currency';
    }
    if (cmd.includes('रोकें') || cmd.includes('बंद') || cmd.includes('நிறுத்து') || cmd.includes('ఆపు') || cmd.includes('ನಿಲ್ಲಿಸು')) {
      normalizedCmd += ' stop';
    }
    if (cmd.includes('नेविगेट') || cmd.includes('रास्ता') || cmd.includes('வழி') || cmd.includes('ಮಾರ್ಗ')) {
      normalizedCmd += ' navigate';
    }

    console.log(`Command processed: "${transcript}" -> "${normalizedCmd}"`);

    // Yes/No response for navigation check
    if (lastFoundNearestName.current && (normalizedCmd === 'yes' || normalizedCmd === 'sure' || normalizedCmd.includes('yes please') || normalizedCmd.includes('navigate'))) {
      if (lastFoundNearestCoords.current) {
        const destCoords = lastFoundNearestCoords.current;
        const destName = lastFoundNearestName.current;
        lastFoundNearestName.current = '';
        lastFoundNearestCoords.current = null;
        speakIfNotMuted(`Starting navigation to ${destName}.`);
        try {
          const baseLat = currentCoords ? currentCoords[0] : 12.9716;
          const baseLon = currentCoords ? currentCoords[1] : 80.2454;
          setDestinationCoords(destCoords);
          const route = await getWalkingRoute([baseLat, baseLon], destCoords);
          setRouteCoords(route.coordinates);
          setRouteSteps(route.steps);
          setNavDestination(destName.split(',')[0]);
          setDistanceRemaining(route.distance);
          setEtaMinutes(Math.ceil(route.duration / 60));
          setNavActive(true);
          setIsSimulatingWalk(true);
          setNavStep(0);
          setSimulatedLoc([baseLat, baseLon]);
          setCurrentRoadName(route.steps[0]?.instruction || 'Start walking');
        } catch (e) {
          console.warn('Navigation failed from choice:', e);
        }
      }
      return;
    }

    // AI Memory Location parsing
    if (normalizedCmd.includes('take me home') || normalizedCmd.includes('go home') || normalizedCmd === 'navigate home') {
      const address = settings.home_address;
      if (address) {
        startRouteNavigation(address);
      } else {
        speakIfNotMuted("Home address is not configured. Please add it in settings.");
      }
      return;
    }

    if (normalizedCmd.includes('take me to college') || normalizedCmd.includes('go to college') || normalizedCmd === 'navigate to college') {
      const address = settings.college_address;
      if (address) {
        startRouteNavigation(address);
      } else {
        speakIfNotMuted("College address is not configured. Please add it in settings.");
      }
      return;
    }

    if (normalizedCmd.includes('take me to favorite') || normalizedCmd.includes('go to favorite') || normalizedCmd === 'navigate to favorite') {
      const address = settings.favorite_place;
      if (address) {
        startRouteNavigation(address);
      } else {
        speakIfNotMuted("Favorite destination is not configured. Please add it in settings.");
      }
      return;
    }

    // Navigation and route management
    const isNavigate = 
      normalizedCmd.includes('navigate') || 
      normalizedCmd.includes('take me to') || 
      normalizedCmd.includes('go to') ||
      normalizedCmd.includes('नेविगेट') || 
      normalizedCmd.includes('रास्ता') || 
      normalizedCmd.includes('வழி') || 
      normalizedCmd.includes('మార్గ') ||
      normalizedCmd.includes('ಮಾರ್ಗ') ||
      normalizedCmd.includes('चलो') ||
      normalizedCmd.includes('போ') ||
      normalizedCmd.includes('వెళ్ళు');

    if (isNavigate) {
      // Helper function to extract destination
      const extractDestination = (text: string): string | null => {
        let cleaned = text.toLowerCase().trim();
        
        // Remove common english prefixes
        cleaned = cleaned.replace(/^(?:take me to|navigate to|go to|navigate)\s+/i, '');
        cleaned = cleaned.replace(/\s+(?:navigate)$/i, '');

        // Remove common regional language navigation keywords
        const stopWords = [
          'के लिए रास्ता', 'रास्ता दिखाओ', 'नेविगेट करो', 'नेविगेट', 'चलो', 'ले चलो',
          'வழி', 'நெவிகேட்', 'போ', 'கூட்டிச்செல்',
          'మార్గం', 'వెళ్ళు', 'తీసుకెళ్ళు',
          'ಮಾರ್ಗ', 'ಹೋಗು', 'ಕರೆದೊಯ್ಯು'
        ];

        for (const word of stopWords) {
          cleaned = cleaned.replace(new RegExp(word, 'g'), '');
        }

        cleaned = cleaned.trim();
        return cleaned.length > 0 ? cleaned : null;
      };

      const dest = extractDestination(normalizedCmd);
      if (dest) {
        startRouteNavigation(dest);
      } else {
        speakIfNotMuted("Please specify a place to navigate.");
      }
    } else if (normalizedCmd.includes('find nearest') || normalizedCmd.includes('nearest')) {
      const match = normalizedCmd.match(/(?:find nearest|nearest)\s+(.+)/);
      if (match && match[1]) {
        const placeQuery = match[1].trim();
        let placeType = placeQuery;
        if (placeQuery.includes('hospital') || placeQuery.includes('medical')) placeType = 'hospital';
        else if (placeQuery.includes('atm') || placeQuery.includes('cash')) placeType = 'atm';
        else if (placeQuery.includes('pharmacy') || placeQuery.includes('chemist')) placeType = 'pharmacy';
        else if (placeQuery.includes('bus stop') || placeQuery.includes('bus')) placeType = 'bus stop';
        else if (placeQuery.includes('restaurant') || placeQuery.includes('food')) placeType = 'restaurant';
        findNearestPlace(placeType);
      }
    } else if (normalizedCmd.includes('cancel navigation') || normalizedCmd.includes('stop navigation')) {
      setNavActive(false);
      setDestinationCoords(null);
      setRouteCoords([]);
      setRouteSteps([]);
      setSimulatedLoc(null);
      setIsSimulatingWalk(false);
      speakIfNotMuted('Navigation stopped.');
      addHistory('navigation', 'Stopped', null, 'Cancelled');
    } else if (normalizedCmd.includes('pause navigation')) {
      setNavActive(false);
      speakIfNotMuted('Navigation paused.');
    } else if (normalizedCmd.includes('resume navigation') || normalizedCmd.includes('continue navigation') || normalizedCmd === 'resume') {
      if (routeCoords.length > 0) {
        setNavActive(true);
        speakIfNotMuted('Resuming navigation.');
      } else {
        speakIfNotMuted('No active route to resume.');
      }
    } else if (normalizedCmd.includes('how far') || normalizedCmd.includes('remaining distance')) {
      if (routeCoords.length > 0) {
        speakIfNotMuted(`Destination is ${distanceRemaining} meters away, about ${etaMinutes} minutes walking.`);
      } else {
        speakIfNotMuted('No active navigation route.');
      }
    } else if (normalizedCmd.includes('next turn') || normalizedCmd.includes('direction')) {
      if (routeCoords.length > 0 && routeSteps[navStep]) {
        speakIfNotMuted(`Your next turn is: ${routeSteps[navStep].instruction}`);
      } else {
        speakIfNotMuted('No active navigation route.');
      }
    } else if (normalizedCmd.includes('repeat instruction') || normalizedCmd.includes('repeat')) {
      if (routeCoords.length > 0 && routeSteps[Math.max(0, navStep - 1)]) {
        speakIfNotMuted(routeSteps[Math.max(0, navStep - 1)].instruction);
      } else {
        speakIfNotMuted('No instructions to repeat.');
      }
    }
    // Scene Understanding Module Commands
    else if (normalizedCmd.includes('what is around me') || normalizedCmd.includes('describe my surroundings') || normalizedCmd.includes('surroundings')) {
      triggerImmediateSceneDescription();
    } else if (
      normalizedCmd.includes('detect objects') || 
      normalizedCmd.includes('tell the objects') || 
      normalizedCmd.includes('what objects') || 
      normalizedCmd.includes('list objects') || 
      normalizedCmd === 'objects' || 
      normalizedCmd.includes('object detection') ||
      normalizedCmd.includes('वस्तुओं') ||
      normalizedCmd.includes('பொருட்கள்') ||
      normalizedCmd.includes('వస్తువులు') ||
      normalizedCmd.includes('ವಸ್ತುಗಳು')
    ) {
      handleObjectDetection();
    } else if (normalizedCmd.includes('read the signs') || normalizedCmd.includes('what does it say') || normalizedCmd.includes('read signs') || normalizedCmd.includes('it say')) {
      speakIfNotMuted("Reading signs.");
      if (videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          try {
            const res = await fetch('http://localhost:8000/api/analyze-frame', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                frame_base64: base64,
                nav_active: navActive,
                destination_number: extractDoorNumber(navDestination), lang: settings.voice_lang })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.ocr_results && data.ocr_results.length > 0) {
                data.ocr_results.forEach((item: any) => {
                  voiceEngine.general(item.announcement);
                });
              } else {
                speakIfNotMuted("No text or signs detected.");
              }
            }
          } catch (e) {
            console.warn(e);
          }
        }
      }
    } else if (normalizedCmd.includes('safe to cross') || normalizedCmd.includes('safe') || normalizedCmd.includes('cross')) {
      if (trafficColor === 'RED') {
        voiceEngine.emergency("Red light detected. It is not safe to cross yet.");
      } else if (trafficColor === 'GREEN') {
        voiceEngine.emergency("Green light. Zebra crossing ahead. Safe to cross.");
      } else if (trafficColor === 'YELLOW') {
        voiceEngine.safety("Yellow light detected. Prepare to stop.");
      } else {
        voiceEngine.general("No traffic light detected. Look carefully before crossing.");
      }
    } else if (normalizedCmd.includes('what color is the light') || normalizedCmd.includes('light color') || normalizedCmd.includes('color of the light')) {
      if (trafficColor !== '--') {
        voiceEngine.general(`The traffic light is currently ${trafficColor.toLowerCase()}.`);
      } else {
        voiceEngine.general("No traffic light is detected currently.");
      }
    } else if (normalizedCmd.includes('is there a zebra crossing') || normalizedCmd.includes('zebra crossing') || normalizedCmd.includes('crossing')) {
      if (zebraCrossingState !== 'NONE') {
        voiceEngine.general(`Yes, a zebra crossing is detected ${zebraCrossingState === 'AT_CROSSING' ? 'at your position' : 'ahead'}.`);
      } else {
        voiceEngine.general("No zebra crossing detected currently.");
      }
    }
    // Context Info
    else if (normalizedCmd.includes('where am i') || normalizedCmd === 'location' || normalizedCmd.includes('coordinates')) {
      const activeLoc = simulatedLoc || currentCoords || [12.9716, 80.2454];
      if (navActive && currentRoadName) {
        speakIfNotMuted(`You are currently on the route. ${currentRoadName}. Location coordinates are latitude ${activeLoc[0].toFixed(4)}, longitude ${activeLoc[1].toFixed(4)}.`);
      } else {
        speakIfNotMuted(`Your current coordinates are latitude ${activeLoc[0].toFixed(4)}, longitude ${activeLoc[1].toFixed(4)}.`);
      }
    } else if (normalizedCmd.includes('battery') || normalizedCmd.includes('power')) {
      speakIfNotMuted(`Smart Glasses battery is at ${batteryLevel} percent, operating normally.`);
    } else if (normalizedCmd.includes('what') && normalizedCmd.includes('front')) {
      handleScene();
    } else if (normalizedCmd.includes('read') || normalizedCmd.includes('ocr') || normalizedCmd.includes('text') || normalizedCmd.includes('what does it say')) {
      handleOCR();
    } else if (normalizedCmd.includes('describe') || normalizedCmd.includes('scene') || normalizedCmd.includes('surroundings')) {
      handleScene();
    } else if (normalizedCmd.includes('color')) {
      handleColor();
    } else if (normalizedCmd.includes('currency') || normalizedCmd.includes('money')) {
      handleCurrency();
    } else if (normalizedCmd.includes('face') || normalizedCmd.includes('person') || normalizedCmd.includes('who')) {
      handleFace();
    } else if (normalizedCmd.includes('stop')) {
      if (currencyModeActive) setCurrencyModeActive(false);
      stopSpeaking();
      setVoiceMessage('');
    } else if (normalizedCmd.includes('start') && normalizedCmd.includes('camera')) {
      if (!cameraOn) startCamera();
    } else if (normalizedCmd.includes('help') || normalizedCmd.includes('emergency') || normalizedCmd.includes('sos')) {
      handleSos();
    } else if (normalizedCmd.includes('fall') || normalizedCmd.includes('fell')) {
      handleFallDetection();
    } else {
      // It is a general question to ask Gemini!
      // Do NOT speak anything here — it would re-trigger isSpeaking and block the recognition restart
      try {
        setAiMood('Thinking');
        const userCtx = `Home: ${settings.home_address}, College: ${settings.college_address}`;
        const answer = await askGemini(transcript, videoRef.current, settings.voice_lang, aiHistory, settings.assistant_name || 'Vision', userCtx);
        if (answer) {
          speakIfNotMuted(answer);
          addHistory('gemini', transcript, null, answer.slice(0, 60));
          setAiHistory(prev => [...prev, {role: 'user', content: transcript}, {role: 'model', content: answer}].slice(-10));
        }
        setAiMood('Calm');
      } catch (err) {
        console.warn("Error asking Gemini:", err);
        speakIfNotMuted("Sorry, I could not reach the AI service at the moment.");
        setAiMood('Calm');
      }
    }
    
    // Update interaction time
    setLastInteractionTime(Date.now());
  }, [
    currentCoords, settings, simulatedLoc, navActive, currentRoadName, batteryLevel,
    distanceRemaining, etaMinutes, routeCoords, routeSteps, navStep, cameraOn,
    speakIfNotMuted, addHistory, startRouteNavigation, findNearestPlace, handleOCR, handleScene, handleColor, handleFace, handleSos, startCamera, handleObjectDetection,
    currencyModeActive, handleCurrency, aiHistory, activeFeature
  ]);

  // Proactive Assistance Mode
  useEffect(() => {
    if (!settings.proactive_mode || analyzing || voiceSpeaking) return;
    
    const interval = window.setInterval(() => {
      const idleTime = Date.now() - lastInteractionTime;
      if (idleTime > 60000) { // 60 seconds
        // Only trigger occasionally
        if (Math.random() < 0.3) {
           speakIfNotMuted(`I'm still here ${settings.assistant_name ? `as ${settings.assistant_name}` : ''}, let me know if you need anything.`);
           setLastInteractionTime(Date.now());
        }
      }
    }, 15000); // Check every 15s
    
    return () => window.clearInterval(interval);
  }, [settings.proactive_mode, settings.assistant_name, lastInteractionTime, analyzing, voiceSpeaking, speakIfNotMuted]);

  // Continuous speech recognition controller with Wake Word
  const startContinuousListening = useCallback(() => {
    if (!speechHelperRef.current || !speechHelperRef.current.isSupported() || isSpeaking()) {
      return;
    }
    setListening(true);
    speechHelperRef.current.start(
      (transcript) => {
        setListening(false);
        const cmd = transcript.trim().toLowerCase();
        console.log(`Continuous transcript heard: "${transcript}"`);

        const wakeWords = ["hey vision", "vision", "assistant"];
        const matchedWakeWord = wakeWords.find(w => cmd.includes(w));

        if (matchedWakeWord) {
          const index = cmd.indexOf(matchedWakeWord);
          const afterWake = cmd.substring(index + matchedWakeWord.length).trim();
          
          if (afterWake.length > 0) {
            processVoiceCommand(afterWake);
          } else {
            speakIfNotMuted("I'm listening, how can I help you?");
            awaitingCommandRef.current = true;
            if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
            commandTimeoutRef.current = window.setTimeout(() => {
              awaitingCommandRef.current = false;
            }, 8000);
          }
        } else {
          if (awaitingCommandRef.current) {
            awaitingCommandRef.current = false;
            if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
            processVoiceCommand(cmd);
          } else {
            console.log("Wake word not detected. Listening ignored.");
          }
        }
      },
      () => {
        setListening(false);
        const restartAfterSpeech = () => {
          if (isSpeaking()) {
            setTimeout(restartAfterSpeech, 300);
          } else if (settings.voice_automation) {
            startContinuousListening();
          }
        };
        setTimeout(restartAfterSpeech, 400);
      }
    );
  }, [settings.voice_automation, speakIfNotMuted, processVoiceCommand]);

  // Sync ref to break circular dependency
  useEffect(() => {
    startListeningRef.current = startContinuousListening;
  }, [startContinuousListening]);

  // Automatic voice command initialization background loop
  useEffect(() => {
    if (settings.voice_automation) {
      setTimeout(() => {
        if (settings.voice_automation && !isSpeaking()) {
          startContinuousListening();
        }
      }, 500);
    } else {
      if (speechHelperRef.current) {
        speechHelperRef.current.stop();
        setListening(false);
      }
    }
    return () => {
      if (speechHelperRef.current) {
        speechHelperRef.current.stop();
      }
    };
  }, [settings.voice_automation, startContinuousListening]);

  // Export CSV
  const exportCsv = useCallback(() => {
    const csv = ['Time,Type,Label,Confidence,Action'];
    for (const h of history) {
      csv.push(`${h.time},${h.type},${h.label},${h.confidence ?? ''},${h.action}`);
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'visionassist_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [history]);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    localStorage.removeItem('visionassist_history');
    try {
      await supabase.from('detection_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.warn('Failed to clear history from Supabase:', e);
    }
  }, []);

  // Standard Voice manual trigger callback
  const handleVoiceCommand = useCallback(() => {
    if (!speechHelperRef.current?.isSupported()) {
      speakIfNotMuted('Voice recognition not supported in this browser.');
      return;
    }
    if (settings.voice_automation) {
      // Toggle off automation if clicked
      setSettings(s => {
        const next = { ...s, voice_automation: false };
        localStorage.setItem('visionassist_settings', JSON.stringify(next));
        return next;
      });
      speakIfNotMuted('Automatic voice control disabled.');
      return;
    }
    
    // Single prompt start
    speakIfNotMuted("I'm listening.", () => {
      setListening(true);
      speechHelperRef.current?.start(
        (transcript) => {
          setListening(false);
          processVoiceCommand(transcript);
        },
        () => {
          setListening(false);
        }
      );
    });
  }, [settings.voice_automation, speakIfNotMuted, processVoiceCommand]);

  // Keyboard shortcut listener effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (cameraOn) stopCamera();
          else startCamera();
          break;
        case 'o':
          if (cameraOn) handleOCR();
          break;
        case 's':
          if (cameraOn) handleScene();
          break;
        case 'c':
          if (cameraOn) handleColor();
          break;
        case 'f':
          if (cameraOn) handleFace();
          break;
        case 'v':
          handleVoiceCommand();
          break;
        case 'm':
          setMuted(m => !m);
          break;
        case 'd':
          if (navActive) {
            simulateDeviation();
          }
          break;
        case 'e':
          handleSos();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraOn, navActive, handleOCR, handleScene, handleColor, handleFace, handleSos, startCamera, stopCamera, simulateDeviation, handleVoiceCommand]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
      stopSpeaking();
    };
  }, []);

  const detections = visionResult?.objects || [];

  if (view === 'admin') return <AdminView onBack={() => setView('dashboard')} history={history} fps={fps} />;
  if (view === 'settings') return (
    <SettingsView 
      onBack={() => setView('dashboard')} 
      settings={settings} 
      setSettings={setSettings} 
      contacts={contacts} 
      setContacts={setContacts} 
      registeredFaces={registeredFaces}
      setRegisteredFaces={setRegisteredFaces}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        {/* Top bar */}
        <nav className="sticky top-0 z-40 glass border-b border-slate-200/50">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onExit} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Home className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-800">VisionAssist</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings.voice_automation && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-500/10 text-success-600 border border-success-500/20 text-xs font-semibold animate-pulse">
                  <Mic className="w-3.5 h-3.5" /> AUTO VOICE
                </div>
              )}
              <button
                onClick={() => {
                  const nextLang = settings.voice_lang?.startsWith('ta') ? 'en-US' : 'ta-IN';
                  const updated = { ...settings, voice_lang: nextLang };
                  setSettings(updated);
                  setItem('visionassist_settings', updated);
                  configureSpeech(updated.voice_speed || 1.0, nextLang, updated.voice_pitch || 1.0, updated.voice_volume || 1.0);
                  if (nextLang === 'ta-IN') {
                    voiceEngine.general('தமிழ் மொழி தேர்வு செய்யப்பட்டது.');
                  } else {
                    voiceEngine.general('English language selected.');
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 transition-colors text-xs font-bold text-primary-700"
                title="Switch Language (English / தமிழ்)"
              >
                🌐 {settings.voice_lang?.startsWith('ta') ? 'தமிழ்' : 'EN'}
              </button>
              <button onClick={() => setView('admin')} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Admin">
                <BarChart3 className="w-5 h-5 text-slate-600" />
              </button>
              <button onClick={() => setView('settings')} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Settings">
                <Settings className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={() => { setMuted(!muted); if (!muted) stopSpeaking(); }}
                className={`p-2 rounded-lg transition-colors ${muted ? 'bg-error-500/10' : 'hover:bg-slate-100'}`}
              >
                {muted ? <VolumeX className="w-5 h-5 text-error-500" /> : <Volume2 className="w-5 h-5 text-slate-600" />}
              </button>
            </div>
          </div>
        </nav>

        {error && (
          <div className="max-w-[1600px] mx-auto px-4 pt-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-error-500/10 text-error-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-2">
          {/* AI Status Bar */}
          <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-slate-200/60 card-shadow flex items-center gap-6 overflow-x-auto">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center text-white">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium">Assistant</span>
                <span className="text-sm font-bold text-slate-800">{settings.assistant_name || 'Vision'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">State:</span>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${isOffline ? 'bg-slate-100 text-slate-500' : navActive ? 'bg-primary-50 text-primary-600' : voiceSpeaking ? 'bg-green-50 text-green-600 animate-pulse' : aiMood === 'Thinking' ? 'bg-purple-50 text-purple-600 animate-pulse' : listening ? 'bg-blue-50 text-blue-600 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
                {isOffline ? '🔌 Offline' : navActive ? '🧭 Navigation' : voiceSpeaking ? '🗣️ Speaking' : aiMood === 'Thinking' ? '🤔 Thinking' : listening ? '🟢 Listening' : '⚪ Standby'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Memory:</span>
              <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {aiHistory.length} items
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Confidence:</span>
              <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-success-500 rounded-full transition-all" style={{ width: `${aiConfidence}%` }}></div>
              </div>
              <span className="text-xs font-bold text-slate-700">{aiConfidence}%</span>
            </div>

            {navActive && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-auto">
                <span className="text-xs text-slate-500 font-medium">Navigation:</span>
                <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 animate-pulse">
                  Active ({Math.round(distanceRemaining)}m)
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Webcam & Emergency SOS controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary-600" />
                  <span className="font-semibold text-slate-700">Live Glasses Camera</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {analyzing && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-500/10 text-accent-600 font-medium animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> AI
                    </span>
                  )}
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
                    cameraStatus === 'on' ? 'bg-success-500/10 text-success-600' :
                    cameraStatus === 'starting' ? 'bg-warning-500/10 text-warning-600' :
                    cameraStatus === 'error' ? 'bg-error-500/10 text-error-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      cameraStatus === 'on' ? 'bg-success-500 animate-pulse' :
                      cameraStatus === 'starting' ? 'bg-warning-500 animate-pulse' :
                      cameraStatus === 'error' ? 'bg-error-500' :
                      'bg-slate-300'
                    }`} />
                    {cameraStatus === 'on' ? 'Live' : cameraStatus === 'starting' ? 'Starting...' : cameraStatus === 'error' ? 'Error' : 'Off'}
                  </span>
                  {cameraOn && <span className="text-slate-500 font-mono font-bold">{fps} FPS</span>}
                </div>
              </div>

              {/* Status HUD ribbon */}
              <div className="grid grid-cols-5 gap-1 bg-slate-50 border-b border-slate-100 p-2.5 text-[10px] font-semibold text-slate-500 text-center">
                <div className="border-r border-slate-200">
                  <span className="block text-slate-400 font-bold uppercase text-[8px] leading-none mb-0.5">Battery</span>
                  <span className={`font-bold ${batteryLevel <= 15 ? 'text-error-500 animate-pulse' : 'text-slate-700'}`}>{batteryLevel}%</span>
                </div>
                <div className="border-r border-slate-200">
                  <span className="block text-slate-400 font-bold uppercase text-[8px] leading-none mb-0.5">Speed</span>
                  <span className="font-bold text-slate-700">{speedMps} m/s</span>
                </div>
                <div className="border-r border-slate-200">
                  <span className="block text-slate-400 font-bold uppercase text-[8px] leading-none mb-0.5">GPS</span>
                  <span className="font-bold text-success-600">Active</span>
                </div>
                <div className="border-r border-slate-200">
                  <span className="block text-slate-400 font-bold uppercase text-[8px] leading-none mb-0.5">AI Engine</span>
                  <span className="font-bold text-primary-600 font-mono">Coco/Cloud</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-bold uppercase text-[8px] leading-none mb-0.5">Mic</span>
                  <span className={`font-bold ${listening ? 'text-success-600 animate-pulse' : 'text-slate-700'}`}>{listening ? 'Listening' : 'Standby'}</span>
                </div>
              </div>

              <div className="relative aspect-video bg-slate-950">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10" />
                {cameraOn && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
                    {detections.slice(0, 4).map((d, i) => (
                      <div key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold text-white backdrop-blur-md shadow-sm border border-white/10 ${
                        d.distanceMeters <= 1 ? 'bg-rose-600/90' :
                        d.distanceMeters <= 2 ? 'bg-amber-500/90' : 'bg-emerald-600/90'
                      }`}>
                        {d.class} · {d.distance} · {d.position}
                      </div>
                    ))}
                  </div>
                )}
                {analyzing && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-sm z-20 border border-slate-800">
                    <Loader2 className="w-4 h-4 text-accent-400 animate-spin" />
                    <span className="text-xs text-white font-medium">Analyzing...</span>
                  </div>
                )}
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                    <CameraOff className="w-16 h-16 mb-4 opacity-30 text-primary-400" />
                    <p className="text-sm font-semibold">Camera Stream Offline</p>
                    <p className="text-xs text-slate-500 mt-1">Activate the webcam simulator to begin AI bounding boxes</p>
                  </div>
                )}
                {cameraStatus === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-error-400 bg-slate-900">
                    <AlertCircle className="w-12 h-12 mb-3" />
                    <p className="text-sm font-semibold">Camera Access Blocked</p>
                  </div>
                )}
              </div>
              <div className="p-4 flex gap-2">
                {!cameraOn ? (
                  <button
                    onClick={() => startCamera()}
                    disabled={cameraStatus === 'starting'}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:brightness-105 transition-all disabled:opacity-50"
                  >
                    <Play className="w-5 h-5" /> Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={stopCamera}
                      className="flex-1 px-4 py-3 rounded-xl bg-error-500 hover:bg-error-600 text-white font-semibold flex items-center justify-center gap-2 hover:shadow-md transition-all"
                    >
                      <Square className="w-5 h-5" /> Stop Camera
                    </button>
                    <button
                      onClick={toggleCamera}
                      className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all border border-slate-200"
                      title="Flip Camera"
                    >
                      <RefreshCw className="w-5 h-5" /> Flip
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick AI Features */}
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary-600" /> AI Features
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'ocr', icon: Scan, label: 'Read Text', action: handleOCR },
                  { id: 'scene', icon: Eye, label: 'Describe', action: handleScene },
                  { id: 'objects', icon: Target, label: 'Objects', action: handleObjectDetection },
                  { id: 'color', icon: Palette, label: 'Color', action: handleColor },
                  { id: 'currency', icon: DollarSign, label: 'Currency', action: handleCurrency },
                  { id: 'face', icon: ScanFace, label: 'Face', action: handleFace },
                  { id: 'voice', icon: Mic, label: listening ? 'Listening...' : settings.voice_automation ? 'Auto Voice' : 'Voice', action: handleVoiceCommand },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={f.action}
                    disabled={!cameraOn || analyzing}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all disabled:opacity-40 ${
                      activeFeature === f.id ? 'bg-primary-50 border-primary-300' : 'border-slate-200 hover:border-primary-200 hover:bg-primary-50/50'
                    }`}
                  >
                    <f.icon className={`w-5 h-5 ${activeFeature === f.id ? 'text-primary-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-medium text-slate-600">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency SOS Trigger */}
            <button
              onClick={handleSos}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-error-500 to-error-600 text-white font-bold flex items-center justify-center gap-3 hover:shadow-lg hover:from-error-600 hover:to-error-700 transition-all shadow-md"
            >
              <AlertTriangle className="w-6 h-6 animate-pulse" />
              TRIGGER EMERGENCY SOS
            </button>

            {/* Keyboard Shortcuts Accessibility Guide */}
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
              <h3 className="font-semibold text-slate-700 mb-2.5 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600 animate-pulse" /> Accessibility Shortcuts
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Camera</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">Space</kbd>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Voice Mic</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">V</kbd>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Read Text</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">O</kbd>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Describe</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">S</kbd>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Color</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">C</kbd>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Face</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">F</kbd>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Off-Route</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">D</kbd>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium">Mute</span>
                  <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm font-semibold">M</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Live Voice Navigation HUD & Interactive Map */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Navigation Card */}
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary-600 animate-pulse" /> Live Navigation
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                  <span className={`px-2 py-0.5 rounded-full ${
                    gpsStatus === 'active' ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    GPS: {gpsStatus.toUpperCase()}
                  </span>
                  {navActive && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 animate-pulse">
                      NAVIGATING
                    </span>
                  )}
                </div>
              </div>

              {/* Destination Geocoding Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={navDestination}
                  onChange={(e) => setNavDestination(e.target.value)}
                  placeholder="Where to? (e.g. Agni College)"
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none"
                />
                {!navActive ? (
                  <button
                    onClick={() => startRouteNavigation(navDestination)}
                    disabled={!navDestination}
                    className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-primary-700 transition-colors"
                  >
                    Go
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setNavActive(false);
                      setDestinationCoords(null);
                      setRouteCoords([]);
                      setRouteSteps([]);
                      setSimulatedLoc(null);
                      setIsSimulatingWalk(false);
                      speakIfNotMuted('Navigation stopped.');
                    }}
                    className="px-4 py-2 bg-error-500 text-white text-sm font-semibold rounded-xl hover:bg-error-600 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Real-time Distance, ETA, Road instructions HUD */}
              {navActive && (
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                  <div className="bg-slate-50 p-2 rounded-xl flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] leading-none mb-0.5">Distance</span>
                      <span className="font-bold text-slate-700 font-mono text-sm">{distanceRemaining}m</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-400 block mb-0.5">ETA</span>
                    <span className="font-bold text-slate-700 font-mono text-sm">{etaMinutes} mins</span>
                  </div>
                  <div className="col-span-2 bg-primary-50 text-primary-700 p-2.5 rounded-xl border border-primary-100">
                    <span className="text-[10px] text-primary-500 font-semibold block mb-0.5">CURRENT ROAD / DIRECTIVE</span>
                    <span className="font-bold block leading-tight">{currentRoadName || 'Continue straight'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Leaflet Map HUD */}
            <div className="h-[280px] bg-white rounded-2xl card-shadow border border-slate-100 overflow-hidden relative">
              <MapPanel
                currentLocation={currentCoords}
                destination={destinationCoords}
                routeCoordinates={routeCoords}
                simulatedUserLocation={simulatedLoc}
                mapType={(settings.map_type as 'standard' | 'dark' | 'satellite') || 'standard'}
              />
            </div>

            {/* AI Warning Alerts overlay */}
            {visionResult?.warning && (
              <div className="bg-error-50 rounded-2xl border border-error-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-error-600" />
                  <span className="text-sm font-semibold text-error-700">{visionResult.warning}</span>
                </div>
              </div>
            )}

            {/* OCR Result */}
            {ocrText && (
              <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
                <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Scan className="w-5 h-5 text-primary-600" /> Text Recognition
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl max-h-32 overflow-y-auto">{ocrText}</p>
              </div>
            )}

            {/* Scene Description */}
            {sceneText && (
              <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
                <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary-600" /> Scene Description
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">{sceneText}</p>
              </div>
            )}

            {/* Color Result */}
            {colorResult && (
              <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary-600" /> Color
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl border-2 border-slate-200" style={{ backgroundColor: colorResult.hex }} />
                    <div>
                      <div className="font-semibold text-slate-700">{colorResult.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{colorResult.hex}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Currency Recognition Module Card */}
            {currencyModeActive && (
              <div className="bg-white rounded-2xl card-shadow border-2 border-primary-500 overflow-hidden relative">
                <div className="bg-primary-500 text-white p-3 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 animate-pulse" /> Currency Scanner Active
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={scanCurrencyNow}
                      className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Scan className="w-3.5 h-3.5" /> Scan Now
                    </button>
                    <button onClick={() => { setCurrencyModeActive(false); setActiveFeature(''); }} className="text-white hover:text-red-200">
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Detection Status</p>
                      <p className={`font-semibold ${currencyData?.detected ? 'text-success-600 text-base' : 'text-slate-700'}`}>
                        {currencyData?.detected ? currencyData.currency : "Waiting for currency note or coin..."}
                      </p>
                    </div>
                    {currencyData?.detected && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Confidence</p>
                        <p className="font-bold text-slate-700">{(currencyData.confidence * 100).toFixed(1)}%</p>
                        {currencyData.time_ms > 0 && (
                          <p className="text-[9px] text-slate-400 font-mono">{currencyData.time_ms}ms</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {currencyHistory.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                         <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Recent Detections</h4>
                         <button onClick={() => setCurrencyHistory([])} className="text-[10px] text-primary-600 font-semibold hover:underline">Clear</button>
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {currencyHistory.map((h, i) => (
                          <div key={i} className="flex justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="font-medium text-slate-700">{h.text}</span>
                            <div className="flex gap-2 text-slate-500">
                              <span>{(h.conf * 100).toFixed(0)}%</span>
                              <span>{h.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Voice Output & History details */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-primary-600" /> Voice Output
                </h3>
                {/* Voice animation wave */}
                {(listening || speakingState) && (
                  <div className="flex items-center gap-0.5 h-4">
                    <span className="w-0.5 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-0.5 h-3 bg-accent-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-0.5 h-4 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    <span className="w-0.5 h-2 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>
              <div className="bg-slate-50 rounded-xl p-3 min-h-[80px] flex flex-col justify-center relative overflow-hidden">
                {voiceMessage ? (
                  <p className="text-sm text-slate-600 leading-relaxed z-10">{voiceMessage}</p>
                ) : (
                  <p className="text-sm text-slate-400 z-10 font-medium">Voice output will appear here</p>
                )}
                {/* Visualizer wave bars overlay */}
                {(listening || speakingState) && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-600 animate-pulse opacity-85" />
                )}
              </div>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => { stopSpeaking(); setVoiceMessage(''); }}
                  className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                >
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
                <button
                  onClick={handleVoiceCommand}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                    listening ? 'bg-success-500 text-white border-success-600 animate-pulse' : 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100'
                  }`}
                  title="Trigger Voice Command (V)"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Detections List Panel */}
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-600" /> AI Camera Detections
              </h3>
              {detections.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Scan className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{cameraOn ? (analyzing ? 'Analyzing frame...' : 'Waiting for next analysis...') : 'Start camera to detect objects'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {detections.map((d, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 text-xs"
                    >
                      <div className={`w-1.5 h-8 rounded-full ${
                        d.distanceMeters <= 1 ? 'bg-error-500' :
                        d.distanceMeters <= 2 ? 'bg-warning-500' : 'bg-success-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold capitalize text-slate-700">{d.class}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{(d.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          <span className="font-medium text-slate-500">{d.distance}</span>
                          <span>·</span>
                          <span>{d.distanceMeters}m</span>
                          <span>·</span>
                          <span className="capitalize">{d.position}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Detection History */}
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-600" /> History
                </h3>
                <div className="flex gap-1">
                  <button onClick={exportCsv} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Export CSV">
                    <Download className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={clearHistory} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Clear">
                    <Trash2 className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">No detections yet</p>
                ) : (
                  history.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-xs">
                      <span className="text-slate-400 font-mono">{h.time}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">{h.type}</span>
                      <span className="flex-1 truncate text-slate-600">{h.label}</span>
                      {h.confidence !== null && <span className="font-mono text-slate-400">{(h.confidence * 100).toFixed(0)}%</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SOS Modal */}
        <AnimatePresence>
          {showSos && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowSos(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-sm w-full text-center"
              >
                {sosSent ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-success-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-success-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">SOS ALERT SENT</h3>
                    <p className="text-sm text-slate-600 mb-4">Emergency message and coordinates sent to your contacts. Auto-navigation to nearest hospital active.</p>
                    <button onClick={() => setShowSos(false)} className="px-6 py-2.5 rounded-xl bg-primary-600 text-white font-semibold">Close</button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-error-500/10 flex items-center justify-center mx-auto mb-4">
                      <Loader2 className="w-8 h-8 text-error-500 animate-spin" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Sending SOS...</h3>
                    <p className="text-sm text-slate-600">Acquiring GPS location and alerting contacts.</p>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scene Understanding Panel */}
        <div className="max-w-[1600px] w-full mx-auto px-4 pb-8 space-y-4">
          <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4 space-y-4">
            {/* Top row status indicators */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary-600 animate-pulse" />
                <h3 className="font-bold text-slate-800">Scene Understanding Panel</h3>
              </div>
              <div className="flex flex-wrap gap-2 md:ml-auto">
                {/* Traffic light indicator */}
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm border ${
                  trafficColor === 'RED' ? 'bg-error-500/10 text-error-600 border-error-200 animate-pulse' :
                  trafficColor === 'GREEN' ? 'bg-success-500/10 text-success-600 border-success-200 animate-pulse' :
                  trafficColor === 'YELLOW' ? 'bg-warning-500/10 text-warning-600 border-warning-200 animate-pulse' :
                  'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    trafficColor === 'RED' ? 'bg-error-500' :
                    trafficColor === 'GREEN' ? 'bg-success-500' :
                    trafficColor === 'YELLOW' ? 'bg-warning-500' :
                    'bg-slate-300'
                  }`} />
                  {trafficColor !== '--' ? `${trafficColor} LIGHT` : 'NO TRAFFIC SIGNAL'}
                </span>
                
                {/* Zebra Crossing status */}
                {zebraCrossingState !== 'NONE' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-50 text-primary-600 border border-primary-200 shadow-sm flex items-center gap-1.5 animate-pulse">
                    🦓 ZEBRA CROSSING DETECTED ({zebraCrossingState})
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">
                    🦓 NO CROSSING DETECTED
                  </span>
                )}

                {/* Scene Active status indicator */}
                <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-all duration-300 flex items-center gap-1.5 ${
                  sceneActivePulse ? 'bg-primary-600 text-white border-primary-700 shadow-md animate-bounce' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  👁 SCENE ACTIVE
                </span>
              </div>
            </div>

            {/* Middle row cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Scene Description */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 hover:shadow-md transition-shadow">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-primary-600" /> Scene Description
                </h4>
                <p className="text-sm font-semibold text-slate-700 leading-relaxed min-h-[60px]">
                  {sceneText || 'Awaiting periodic description (updates every 10 seconds)...'}
                </p>
              </div>

              {/* Card 2: Last OCR Reading */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 hover:shadow-md transition-shadow">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Scan className="w-4 h-4 text-primary-600" /> Last OCR Reading
                </h4>
                <p className="text-sm font-bold text-slate-700 leading-relaxed min-h-[60px]">
                  {ocrText ? ocrText : 'Scanning signs, bus routes, doors...'}
                </p>
              </div>

              {/* Card 3: Traffic Light Status */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-[10px] uppercase shadow-inner ${
                    trafficColor === 'RED' ? 'bg-error-500 border-error-600 text-white animate-pulse' :
                    trafficColor === 'GREEN' ? 'bg-success-500 border-success-600 text-white animate-pulse' :
                    trafficColor === 'YELLOW' ? 'bg-warning-500 border-warning-600 text-white animate-pulse' :
                    'bg-slate-200 border-slate-300 text-slate-400'
                  }`}>
                    {trafficColor}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Signal Details</h4>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                    {trafficColor !== '--' ? (trafficConfirmed ? 'Confirmed' : 'Detecting...') : 'None Detected'}
                  </p>
                </div>
              </div>

              {/* Card 4: Zebra Crossing */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-14 h-14 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm ${
                  zebraCrossingState !== 'NONE' ? 'bg-primary-50 border-primary-200 text-primary-600 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  <Glasses className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zebra Crossing</h4>
                  <p className="text-sm font-bold text-slate-700 capitalize mt-0.5">
                    {zebraCrossingState !== 'NONE' ? zebraCrossingState.toLowerCase().replace('_', ' ') : 'Clear'}
                  </p>
                  {vehicleOnCrossing && (
                    <span className="text-[10px] text-error-600 font-bold block animate-bounce">Vehicle on crossing!</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Bar: Voice Queue indicator */}
            <div className="bg-slate-950 text-slate-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner border border-slate-800">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-accent-400 animate-pulse" />
                <span className="font-semibold">
                  {voiceSpeaking ? (
                    <>Speaking ({
                      voicePriority === 1 ? 'CRITICAL' :
                      voicePriority === 2 ? 'WARNING' :
                      voicePriority === 3 ? 'INFO' : 'AMBIENT'
                    }): <span className="text-white italic">"{voiceText}"</span></>
                  ) : (
                    'Voice assistant is idle.'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto font-mono text-[11px]">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold">
                  Queue size: {voiceQueueSize}
                </span>
                {voiceSpeaking && (
                  <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                    voicePriority === 1 ? 'bg-error-500 text-white animate-pulse' :
                    voicePriority === 2 ? 'bg-warning-500 text-slate-900' :
                    voicePriority === 3 ? 'bg-primary-500 text-white' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {voicePriority === 1 ? 'CRITICAL' :
                     voicePriority === 2 ? 'WARNING' :
                     voicePriority === 3 ? 'INFO' : 'AMBIENT'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Footer */}
      <footer className="py-6 border-t border-slate-200 mt-8 text-center text-xs text-slate-500 bg-white">
        <p>VisionAssist Dashboard — Developed by <span className="font-semibold text-primary-600">PRIYAN</span></p>
      </footer>
    </div>
  );
}

// Admin View
function AdminView({ onBack, history, fps }: { onBack: () => void; history: HistoryEntry[]; fps: number }) {
  const [stats, setStats] = useState({ detections: 0, ocr: 0, voice: 0, sessions: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { count: detCount } = await supabase.from('detection_history').select('*', { count: 'exact', head: true });
        const { count: ocrCount } = await supabase.from('detection_history').select('*', { count: 'exact', head: true }).eq('type', 'ocr');
        const { count: voiceCount } = await supabase.from('detection_history').select('*', { count: 'exact', head: true }).eq('type', 'voice');
        const { count: sessionCount } = await supabase.from('demo_sessions').select('*', { count: 'exact', head: true });
        const { data: activity } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20);
        setStats({ detections: detCount || 0, ocr: ocrCount || 0, voice: voiceCount || 0, sessions: sessionCount || 0 });
        setRecentActivity(activity || []);
      } catch (e) {
        console.warn('Failed to load admin stats from Supabase:', e);
        // Fallback stats from local history
        const localHistory = localStorage.getItem('visionassist_history');
        let count = 0;
        let ocr = 0;
        let voice = 0;
        if (localHistory) {
          try {
            const parsed = JSON.parse(localHistory);
            count = parsed.length;
            ocr = parsed.filter((h: HistoryEntry) => h.type === 'ocr').length;
            voice = parsed.filter((h: HistoryEntry) => h.type === 'voice').length;
          } catch (e) {
            console.warn('Failed to parse local history for stats:', e);
          }
        }
        setStats({ detections: count, ocr, voice, sessions: 1 });
        setRecentActivity([{ created_at: new Date().toISOString(), event: 'Local Mode Active', details: {} }]);
      }
    })();
  }, [history]);

  const typeCounts = history.reduce((acc, h) => {
    acc[h.type] = (acc[h.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statCards = [
    { label: 'Total Detections', value: stats.detections, icon: Target, color: 'from-primary-500 to-primary-600' },
    { label: 'OCR Reads', value: stats.ocr, icon: Scan, color: 'from-accent-500 to-accent-600' },
    { label: 'Voice Commands', value: stats.voice, icon: Mic, color: 'from-success-500 to-success-600' },
    { label: 'Demo Sessions', value: stats.sessions, icon: Activity, color: 'from-warning-500 to-warning-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        <nav className="sticky top-0 z-40 glass border-b border-slate-200/50">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Home className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-600" />
              <span className="font-bold text-slate-800">Admin Dashboard</span>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-5 card-shadow border border-slate-100">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-2xl font-bold text-slate-800">{s.value}</div>
                <div className="text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" /> Detection Breakdown
              </h3>
              <div className="space-y-3">
                {Object.entries(typeCounts).map(([type, count]) => {
                  const max = Math.max(...Object.values(typeCounts));
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-600 capitalize">{type}</span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(typeCounts).length === 0 && <p className="text-sm text-slate-400">No data yet</p>}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary-600" /> Performance
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm text-slate-600">Current FPS</span>
                  <span className="text-lg font-bold text-primary-600">{fps}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm text-slate-600">AI Engine</span>
                  <span className="text-sm font-semibold text-success-600">Gemini 2.5 Flash</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-sm text-slate-600">Analysis Interval</span>
                  <span className="text-sm font-semibold text-slate-700">4 seconds</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-600" /> Recent Activity
            </h3>
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No recent activity</p>
              ) : (
                recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 text-sm">
                    <span className="text-slate-400 font-mono text-xs">{a.created_at ? new Date(a.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()}</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium text-xs">{a.event}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="py-6 border-t border-slate-200 mt-8 text-center text-xs text-slate-500 bg-white">
        <p>VisionAssist Admin — Developed by <span className="font-semibold text-primary-600">PRIYAN</span></p>
      </footer>
    </div>
  );
}

// Settings View
function SettingsView({ onBack, settings, setSettings, contacts, setContacts, registeredFaces, setRegisteredFaces }: {
  onBack: () => void;
  settings: AppSettings & { 
    voice_automation?: boolean;
    home_address?: string;
    college_address?: string;
    favorite_place?: string;
  };
  setSettings: (s: any) => void;
  contacts: EmergencyContact[];
  setContacts: (c: EmergencyContact[]) => void;
  registeredFaces: string[];
  setRegisteredFaces: (f: string[]) => void;
}) {
  const [local, setLocal] = useState<AppSettings & { 
    voice_automation?: boolean;
    home_address?: string;
    college_address?: string;
    favorite_place?: string;
  }>(settings);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [newFaceLabel, setNewFaceLabel] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'OPENROUTER_API_KEY')
          .maybeSingle();
        if (data?.value) {
          setIsKeyConfigured(true);
          setOpenRouterKey('••••••••••••••••');
        }
      } catch (e) {
        console.warn('Failed to load OpenRouter API key:', e);
      }
    })();
  }, []);

  const save = async () => {
    localStorage.setItem('visionassist_settings', JSON.stringify(local));
    try {
      const { data } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
      const { voice_automation, home_address, college_address, favorite_place, ...dbSettings } = local;
      if (data?.id) {
        await supabase.from('app_settings').update({ ...dbSettings, updated_at: new Date().toISOString() }).eq('id', data.id);
      } else {
        await supabase.from('app_settings').insert(dbSettings);
      }

      // Save or clear OpenRouter key
      if (openRouterKey === '') {
        await supabase
          .from('app_config')
          .delete()
          .eq('key', 'OPENROUTER_API_KEY');
      } else if (openRouterKey && openRouterKey !== '••••••••••••••••') {
        const { error } = await supabase
          .from('app_config')
          .upsert({ key: 'OPENROUTER_API_KEY', value: openRouterKey }, { onConflict: 'key' });
        if (error) throw error;
      }
    } catch (e) {
      console.warn('Failed to save settings/config to Supabase:', e);
    }
    setSettings(local);
    configureSpeech(local.voice_speed || 1.0, local.voice_lang || 'en-US', local.voice_pitch || 1.0, local.voice_volume || 1.0);
    onBack();
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) return;
    const tempId = Date.now().toString();
    const contactToInsert = { ...newContact, id: tempId };
    setContacts([contactToInsert, ...contacts]);
    localStorage.setItem('visionassist_contacts', JSON.stringify([contactToInsert, ...contacts]));

    try {
      const { data } = await supabase.from('emergency_contacts').insert(newContact).select().single();
      if (data) {
        const finalContacts = [data, ...contacts.filter(c => c.id !== tempId)];
        setContacts(finalContacts);
        localStorage.setItem('visionassist_contacts', JSON.stringify(finalContacts));
      }
    } catch (e) {
      console.warn('Failed to add contact to Supabase:', e);
    }
    setNewContact({ name: '', phone: '', relation: '' });
  };

  const removeContact = async (id: string) => {
    const remaining = contacts.filter((c) => c.id !== id);
    setContacts(remaining);
    localStorage.setItem('visionassist_contacts', JSON.stringify(remaining));

    try {
      await supabase.from('emergency_contacts').delete().eq('id', id);
    } catch (e) {
      console.warn('Failed to delete contact from Supabase:', e);
    }
  };

  const addFace = () => {
    if (!newFaceLabel) return;
    const updated = [...registeredFaces, newFaceLabel];
    setRegisteredFaces(updated);
    localStorage.setItem('visionassist_registered_faces', JSON.stringify(updated));
    setNewFaceLabel('');
  };

  const removeFace = (name: string) => {
    const updated = registeredFaces.filter(f => f !== name);
    setRegisteredFaces(updated);
    localStorage.setItem('visionassist_registered_faces', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        <nav className="sticky top-0 z-40 glass border-b border-slate-200/50">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Home className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              <span className="font-bold text-slate-800">Settings</span>
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">Voice Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Voice Speed: {local.voice_speed?.toFixed(1)}x</label>
                <input type="range" min="0.5" max="2" step="0.1" value={local.voice_speed || 1}
                  onChange={(e) => setLocal({ ...local, voice_speed: parseFloat(e.target.value) })}
                  className="w-full accent-primary-600" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Voice Language</label>
                <select value={local.voice_lang || 'en-US'} onChange={(e) => setLocal({ ...local, voice_lang: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none">
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">Hindi (India)</option>
                  <option value="ta-IN">Tamil (India)</option>
                  <option value="te-IN">Telugu (India)</option>
                  <option value="kn-IN">Kannada (India)</option>
                  <option value="bn-IN">Bengali (India)</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 mt-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block">Automatic Voice Control</label>
                  <span className="text-xs text-slate-400">System listens automatically for voice commands</span>
                </div>
                <input
                  type="checkbox"
                  checked={local.voice_automation || false}
                  onChange={(e) => setLocal({ ...local, voice_automation: e.target.checked })}
                  className="w-5 h-5 accent-primary-600 rounded cursor-pointer"
                />
              </div>

              {/* JARVIS Settings */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-2">Assistant Name</label>
                  <input type="text" placeholder="Vision" value={local.assistant_name || 'Vision'}
                    onChange={(e) => setLocal({ ...local, assistant_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-2">Wake Word</label>
                  <input type="text" placeholder="Hey Vision" value={local.wake_word || 'Hey Vision'}
                    onChange={(e) => setLocal({ ...local, wake_word: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-2">Voice Pitch: {local.voice_pitch || 1.0}</label>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={local.voice_pitch || 1.0}
                    onChange={(e) => setLocal({ ...local, voice_pitch: parseFloat(e.target.value) })}
                    className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 block mb-2">Voice Volume: {local.voice_volume || 1.0}</label>
                  <input type="range" min="0.1" max="1.0" step="0.1" value={local.voice_volume || 1.0}
                    onChange={(e) => setLocal({ ...local, voice_volume: parseFloat(e.target.value) })}
                    className="w-full accent-primary-600" />
                </div>
              </div>

            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">Detection Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Confidence Threshold: {((local.confidence_threshold || 0.5) * 100).toFixed(0)}%</label>
                <input type="range" min="0.1" max="0.9" step="0.05" value={local.confidence_threshold || 0.5}
                  onChange={(e) => setLocal({ ...local, confidence_threshold: parseFloat(e.target.value) })}
                  className="w-full accent-primary-600" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Camera Quality</label>
                <select value={local.camera_quality || 'medium'} onChange={(e) => setLocal({ ...local, camera_quality: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none">
                  <option value="low">Low (320p)</option>
                  <option value="medium">Medium (480p)</option>
                  <option value="high">High (720p)</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Memory Locations Configuration */}
          <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" /> AI Memory Locations
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Home Address / Destination</label>
                <input type="text" placeholder="e.g. Marina Beach, Chennai" value={local.home_address || ''}
                  onChange={(e) => setLocal({ ...local, home_address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">College Address / Destination</label>
                <input type="text" placeholder="e.g. Agni College of Technology" value={local.college_address || ''}
                  onChange={(e) => setLocal({ ...local, college_address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Favorite Place Address / Destination</label>
                <input type="text" placeholder="e.g. Apollo Hospital" value={local.favorite_place || ''}
                  onChange={(e) => setLocal({ ...local, favorite_place: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Registered Faces */}
          <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-primary-600" /> Registered Familiar Faces
            </h3>
            <div className="space-y-2 mb-4">
              {registeredFaces.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="flex-1 font-semibold text-slate-700">{f}</span>
                  <button onClick={() => removeFace(f)} className="p-1.5 rounded-lg hover:bg-error-500/10 transition-colors">
                    <X className="w-4 h-4 text-error-500" />
                  </button>
                </div>
              ))}
              {registeredFaces.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">No familiar faces registered yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Face Label (e.g. Raj, Mother)" value={newFaceLabel}
                onChange={(e) => setNewFaceLabel(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-primary-300 focus:outline-none" />
              <button onClick={addFace} className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors">Register</button>
            </div>
          </div>

          {/* Navigation & Map Settings */}
          <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">Map & Navigation Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Navigation Mode</label>
                <select
                  value={local.navigation_mode || 'walking'}
                  onChange={(e) => setLocal({ ...local, navigation_mode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none"
                >
                  <option value="walking">Walking</option>
                  <option value="wheelchair">Wheelchair Assist</option>
                  <option value="indoor">Indoor Navigation (Simulation)</option>
                  <option value="outdoor">Outdoor GPS Tracking</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">Map Style Type</label>
                <select
                  value={local.map_type || 'standard'}
                  onChange={(e) => setLocal({ ...local, map_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none"
                >
                  <option value="standard">Standard Map Layer</option>
                  <option value="dark">Dark Theme HUD</option>
                  <option value="satellite">Satellite Imagery</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">Emergency Contacts</h3>
            <div className="space-y-2 mb-4">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                  <div className="flex-1">
                    <div className="font-medium text-slate-700">{c.name}</div>
                    <div className="text-sm text-slate-500">{c.phone} {c.relation && `· ${c.relation}`}</div>
                  </div>
                  <button onClick={() => removeContact(c.id!)} className="p-1.5 rounded-lg hover:bg-error-500/10 transition-colors">
                    <X className="w-4 h-4 text-error-500" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" placeholder="Name" value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-primary-300 focus:outline-none" />
              <input type="text" placeholder="Phone" value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-primary-300 focus:outline-none" />
              <button onClick={addContact} className="px-3 py-2 text-sm rounded-lg bg-primary-600 text-white font-medium">Add</button>
            </div>
          </div>

          {/* AI API Configuration */}
          <div className="bg-white rounded-2xl p-6 card-shadow border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-600" /> AI API Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-2">
                  OpenRouter API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter sk-or-..."
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-primary-300 focus:outline-none"
                  />
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  {isKeyConfigured
                    ? "✓ API Key is currently configured in the database. Enter a new key to overwrite it."
                    : "No API Key configured. The system will fall back to local client-side analysis."}
                </span>
              </div>
            </div>
          </div>

          <button onClick={save} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold hover:shadow-lg transition-all">
            Save Settings
          </button>
        </div>
      </div>

      <footer className="py-6 border-t border-slate-200 mt-8 text-center text-xs text-slate-500 bg-white">
        <p>VisionAssist Settings — Developed by <span className="font-semibold text-primary-600">PRIYAN</span></p>
      </footer>
    </div>
  );
}
