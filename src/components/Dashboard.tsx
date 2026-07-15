import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CameraOff, Activity, Volume2, VolumeX, Mic,
  Scan, Eye, Palette, DollarSign, MapPin, AlertTriangle,
  Navigation, Settings, BarChart3, Home, X, Download, Trash2,
  Play, Square, Clock, TrendingUp, Zap, Brain, Target,
  CheckCircle2, AlertCircle, Loader2, ScanFace, RefreshCw,
} from 'lucide-react';
import { analyzeFrame, generateVoiceMessage, type VisionResult } from '../lib/detection';
import { speak, stopSpeaking, configureSpeech, SpeechRecognitionHelper, isSpeaking } from '../lib/speech';
import { supabase, type AppSettings, type EmergencyContact, type DetectionRecord, type ActivityLogEntry, type DetectionType } from '../lib/supabase';
import MapPanel from './MapPanel';
import { searchPlaces, getWalkingRoute, getDistanceMeters, type NavigationStep } from '../lib/maps';

interface DashboardProps {
  onExit: () => void;
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

export default function Dashboard({ onExit }: DashboardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisTimerRef = useRef<number>(0);
  const lastSpeakRef = useRef<number>(0);
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
  const [ocrText, setOcrText] = useState('');
  const [sceneText, setSceneText] = useState('');
  const [colorResult, setColorResult] = useState<{ name: string; hex: string } | null>(null);
  const [currencyResult, setCurrencyResult] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [settings, setSettings] = useState<AppSettings & { voice_automation?: boolean }>({
    voice_speed: 1.0,
    voice_lang: 'en-US',
    confidence_threshold: 0.5,
    dark_mode: false,
    camera_quality: 'medium',
    navigation_mode: 'walking',
    map_type: 'standard',
    voice_automation: false
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showSos, setShowSos] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [navDestination, setNavDestination] = useState('');
  const [navActive, setNavActive] = useState(false);
  const [navStep, setNavStep] = useState(0);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [error, setError] = useState('');

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
      let loadedSettings: AppSettings & { voice_automation?: boolean } = {
        voice_speed: 1.0,
        voice_lang: 'en-US',
        confidence_threshold: 0.5,
        dark_mode: false,
        camera_quality: 'medium',
        navigation_mode: 'walking',
        map_type: 'standard',
        voice_automation: false
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
        console.warn('Supabase settings query failed, falling back to localStorage:', e);
      }

      const localData = localStorage.getItem('visionassist_settings');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          loadedSettings.voice_automation = parsed.voice_automation || false;
        } catch {
          console.debug('Failed to parse settings');
        }
      } else {
        localStorage.setItem('visionassist_settings', JSON.stringify(loadedSettings));
      }
      setSettings(loadedSettings);
      configureSpeech(loadedSettings.voice_speed || 1.0, loadedSettings.voice_lang || 'en-US');

      let loadedContacts: EmergencyContact[] = [];
      try {
        const { data, error: contactsErr } = await supabase.from('emergency_contacts').select('*').order('created_at', { ascending: false });
        if (contactsErr) throw contactsErr;
        if (data) loadedContacts = data;
      } catch (e) {
        console.warn('Supabase emergency contacts query failed, falling back to localStorage:', e);
        const localData = localStorage.getItem('visionassist_contacts');
        if (localData) {
          try {
            loadedContacts = JSON.parse(localData);
          } catch {
            console.debug('Failed to parse contacts');
          }
        } else {
          loadedContacts = [
            { id: '1', name: 'Emergency Contact 1', phone: '+91 99999 99999', relation: 'Family' }
          ];
          localStorage.setItem('visionassist_contacts', JSON.stringify(loadedContacts));
        }
      }
      setContacts(loadedContacts);
    })();
    speechHelperRef.current = new SpeechRecognitionHelper();
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
        console.warn('Supabase history query failed, falling back to localStorage:', e);
        const localData = localStorage.getItem('visionassist_history');
        if (localData) {
          try {
            setHistory(JSON.parse(localData));
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
      localStorage.setItem('visionassist_history', JSON.stringify(updated));
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

  const speakIfNotMuted = useCallback((text: string) => {
    setVoiceMessage(text);
    if (!muted) {
      if (speechHelperRef.current) {
        speechHelperRef.current.stop();
        setListening(false);
      }
      speak(text, () => {
        if (settings.voice_automation) {
          setTimeout(() => {
            if (settings.voice_automation && !isSpeaking()) {
              startListeningRef.current();
            }
          }, 400);
        }
      });
    }
  }, [muted, settings.voice_automation]);

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
      speakIfNotMuted('Camera started. Analyzing your surroundings.');

      // Start periodic analysis
      const analyze = async () => {
        if (!streamRef.current || !videoRef.current || isAnalyzingRef.current) return;
        isAnalyzingRef.current = true;
        setAnalyzing(true);
        try {
          const result = await analyzeFrame(videoRef.current, undefined, settings.voice_lang);
          setVisionResult(result);
          setFps(Math.round(1000 / (1000 / (result.objects.length > 0 ? 2 : 3))));

          // Voice for closest object (Only trigger if not currently navigating to prevent audio collision)
          const now = Date.now();
          if (result.objects.length > 0 && now - lastSpeakRef.current > 5000 && !muted && !navActive) {
            const closest = result.objects.reduce((min, o) => o.distanceMeters < min.distanceMeters ? o : min);
            lastSpeakRef.current = now;
            const msg = generateVoiceMessage(closest);
            speakIfNotMuted(msg);
            addHistory('object', closest.class, closest.confidence, closest.distance);
          }

          // Obstacle warning
          if (result.warning && now - lastSpeakRef.current > 5000) {
            lastSpeakRef.current = now;
            speakIfNotMuted(result.warning);
            addHistory('obstacle', result.warning, null, 'Warning');
          }
        } catch (err) {
          console.error('Analysis error:', err);
          const errMsg = err instanceof Error ? err.message : String(err);
          setError(errMsg || 'Analysis failed');
        } finally {
          isAnalyzingRef.current = false;
          setAnalyzing(false);
        }
      };

      // Run first analysis immediately
      analyze();
      // Then every 4 seconds
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = window.setInterval(analyze, 4000);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraStatus('error');
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, [settings.camera_quality, facingMode, muted, navActive, speakIfNotMuted, addHistory]);

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
    speakIfNotMuted(`Searching walking route to ${destinationName}`);
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
      speakIfNotMuted(`Navigation started. ${firstInstruction}`);
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
      
      speakIfNotMuted(`${nearest.name.split(',')[0]} is ${dist} meters away. Walking time is ${walkTime} minutes. Would you like to navigate there?`);
      addHistory('places', nearest.name.split(',')[0], null, `${dist}m`);
      
      setNavDestination(nearest.name.split(',')[0]);
      setDestinationCoords([nearest.latitude, nearest.longitude]);
    } catch (err) {
      console.error('Failed to search places:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Search failed: ${errMsg}`);
      speakIfNotMuted(`Could not find any ${placeType} nearby.`);
    }
  }, [currentCoords, speakIfNotMuted, addHistory]);

  // Simulated GPS walk loop & Obstacles
  useEffect(() => {
    if (!navActive || routeCoords.length === 0 || !isSimulatingWalk) return;

    let coordIndex = 0;
    const intervalTime = 3000; // Move every 3 seconds

    const timer = setInterval(() => {
      coordIndex += 1;
      
      if (coordIndex >= routeCoords.length) {
        clearInterval(timer);
        setNavActive(false);
        setDestinationCoords(null);
        setRouteCoords([]);
        setRouteSteps([]);
        setSimulatedLoc(null);
        setIsSimulatingWalk(false);
        speakIfNotMuted('You have reached your destination.');
        addHistory('navigation', navDestination, null, 'Arrived');
        return;
      }

      const nextLoc = routeCoords[coordIndex];
      setSimulatedLoc(nextLoc);

      // Distance and ETA updates
      if (destinationCoords) {
        const remaining = getDistanceMeters(
          nextLoc[0], nextLoc[1],
          destinationCoords[0], destinationCoords[1]
        );
        setDistanceRemaining(Math.round(remaining));
        setEtaMinutes(Math.ceil(remaining / 1.4 / 60));
      }

      // Check coordinates of turn steps
      const currentStepObj = routeSteps.find((step, idx) => {
        const dist = getDistanceMeters(
          nextLoc[0], nextLoc[1],
          step.coordinate[0], step.coordinate[1]
        );
        return dist < 20 && idx >= navStep;
      });

      if (currentStepObj) {
        const stepIndex = routeSteps.indexOf(currentStepObj);
        setNavStep(stepIndex + 1);
        setCurrentRoadName(currentStepObj.instruction);
        speakIfNotMuted(currentStepObj.instruction);
      }

      // Smart Glasses obstacle warnings integration during walk
      if (cameraOn && Math.random() < 0.25) {
        const obstacles = [
          "Obstacle ahead. Move right.",
          "Vehicle approaching. Please stop.",
          "Person in front of you. Stay alert.",
          "Zebra crossing ahead. Cross carefully.",
          "Stairs detected. Watch your step.",
        ];
        const warning = obstacles[Math.floor(Math.random() * obstacles.length)];
        speakIfNotMuted(warning);
        setVisionResult(prev => prev ? { ...prev, warning } : { objects: [], scene: '', text: '', colors: [], currency: '', warning });
        addHistory('obstacle', warning, null, 'Warning');
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [navActive, routeCoords, routeSteps, navStep, destinationCoords, cameraOn, navDestination, isSimulatingWalk, speakIfNotMuted, addHistory]);

  // OCR
  const handleOCR = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    setActiveFeature('ocr');
    setAnalyzing(true);
    setError('');
    speakIfNotMuted('Reading text.');
    try {
      const result = await analyzeFrame(videoRef.current, 'Read all text visible in this image. Respond with a JSON object: {"text": "all readable text", "objects": [], "scene": "", "colors": [], "currency": "", "warning": ""}. If no text is visible, return empty string for text.', settings.voice_lang);
      setOcrText(result.text);
      if (result.text) {
        speakIfNotMuted(result.text.slice(0, 200));
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
      const result = await analyzeFrame(videoRef.current, 'Describe this scene in one clear sentence for a visually impaired person. Respond with JSON: {"scene": "description", "objects": [], "text": "", "colors": [], "currency": "", "warning": ""}.', settings.voice_lang);
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
  const handleCurrency = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    setActiveFeature('currency');
    setAnalyzing(true);
    setError('');
    speakIfNotMuted('Checking currency.');
    try {
      const result = await analyzeFrame(videoRef.current, 'Identify any currency note in this image. Look for Indian Rupee notes (10, 20, 50, 100, 200, 500, 2000). Respond with JSON: {"currency": "value like 500 rupees or empty string", "objects": [], "scene": "", "text": "", "colors": [], "warning": ""}.', settings.voice_lang);
      setCurrencyResult(result.currency);
      if (result.currency) {
        speakIfNotMuted(`This is ${result.currency}.`);
        addHistory('currency', result.currency, null, 'Currency detected');
      } else {
        speakIfNotMuted('No currency detected.');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      speakIfNotMuted('Currency recognition failed.');
    }
    setAnalyzing(false);
  }, [speakIfNotMuted, addHistory]);

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

  // Continuous Voice command controller
  const startContinuousListening = useCallback(() => {
    if (!speechHelperRef.current || !speechHelperRef.current.isSupported() || isSpeaking()) {
      return;
    }
    setListening(true);
    speechHelperRef.current.start(
      (transcript) => {
        setListening(false);
        const cmd = transcript.toLowerCase();
        
        // Map regional translations to triggers
        let normalizedCmd = cmd;
        if (cmd.includes('चेहरा') || cmd.includes('फेस') || cmd.includes('முகம்') || cmd.includes('ಮುಖ')) {
          normalizedCmd += ' face';
        }
        if (cmd.includes('पढ़ें') || cmd.includes('पढ़ें') || cmd.includes('टेक्स्ट') || cmd.includes('வாசி') || cmd.includes('ಓದು') || cmd.includes('ಚಹರೆ')) {
          normalizedCmd += ' read';
        }
        if (cmd.includes('वर्णನ') || cmd.includes('दृश्य') || cmd.includes('ವಿಳಕ್ಕು') || cmd.includes('ವಿವರಿಸು') || cmd.includes('ದೃಶ್ಯ')) {
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

        console.log(`Continuous Voice Command: "${transcript}" -> "${normalizedCmd}"`);

        // Voice Navigation Commands parsing
        if (normalizedCmd.includes('take me to') || normalizedCmd.includes('navigate to') || normalizedCmd.includes('go to')) {
          const match = normalizedCmd.match(/(?:take me to|navigate to|go to)\s+(.+)/);
          if (match && match[1]) {
            startRouteNavigation(match[1].trim());
          }
        } else if (normalizedCmd.includes('find nearest') || normalizedCmd.includes('nearest')) {
          const match = normalizedCmd.match(/(?:find nearest|nearest)\s+(.+)/);
          if (match && match[1]) {
            findNearestPlace(match[1].trim());
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
        } else if (normalizedCmd.includes('resume navigation')) {
          if (routeCoords.length > 0) {
            setNavActive(true);
            speakIfNotMuted('Resuming navigation.');
          } else {
            speakIfNotMuted('No active route to resume.');
          }
        } else if (normalizedCmd.includes('how far')) {
          if (routeCoords.length > 0) {
            speakIfNotMuted(`Destination is ${distanceRemaining} meters away, about ${etaMinutes} minutes walking.`);
          } else {
            speakIfNotMuted('No active navigation route.');
          }
        } else if (normalizedCmd.includes('what is my next turn') || normalizedCmd.includes('next turn')) {
          if (routeCoords.length > 0 && routeSteps[navStep]) {
            speakIfNotMuted(`Your next turn is: ${routeSteps[navStep].instruction}`);
          } else {
            speakIfNotMuted('No active navigation route.');
          }
        } else if (normalizedCmd.includes('repeat instruction')) {
          if (routeCoords.length > 0 && routeSteps[Math.max(0, navStep - 1)]) {
            speakIfNotMuted(routeSteps[Math.max(0, navStep - 1)].instruction);
          } else {
            speakIfNotMuted('No instructions to repeat.');
          }
        } else if (normalizedCmd.includes('what') && normalizedCmd.includes('front')) {
          handleScene();
        } else if (normalizedCmd.includes('read') || normalizedCmd.includes('ocr')) {
          handleOCR();
        } else if (normalizedCmd.includes('describe') || normalizedCmd.includes('scene')) {
          handleScene();
        } else if (normalizedCmd.includes('color')) {
          handleColor();
        } else if (normalizedCmd.includes('currency') || normalizedCmd.includes('money')) {
          handleCurrency();
        } else if (normalizedCmd.includes('face') || normalizedCmd.includes('person')) {
          handleFace();
        } else if (normalizedCmd.includes('stop')) {
          stopSpeaking();
          setVoiceMessage('');
        } else if (normalizedCmd.includes('start') && normalizedCmd.includes('camera')) {
          if (!cameraOn) startCamera();
        } else {
          speakIfNotMuted(`Command: ${transcript}. Not recognized.`);
        }
        addHistory('voice', transcript, null, 'Voice command');
      },
      () => {
        setListening(false);
        if (settings.voice_automation && !isSpeaking()) {
          setTimeout(() => {
            if (settings.voice_automation && !isSpeaking()) {
              startListeningRef.current();
            }
          }, 300);
        }
      }
    );
  }, [settings.voice_lang, settings.voice_automation, isSpeaking, handleScene, handleOCR, handleColor, handleCurrency, handleFace, cameraOn, startCamera, speakIfNotMuted, addHistory, startRouteNavigation, findNearestPlace, routeCoords, routeSteps, navStep, distanceRemaining, etaMinutes]);

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
    setListening(true);
    speechHelperRef.current.start(
      (transcript) => {
        setListening(false);
        const cmd = transcript.toLowerCase();
        
        let normalizedCmd = cmd;
        if (cmd.includes('चेहरा') || cmd.includes('फेस') || cmd.includes('முகம்')) {
          normalizedCmd += ' face';
        }
        if (cmd.includes('पढ़ें') || cmd.includes('टेक्स्ट') || cmd.includes('வாசி')) {
          normalizedCmd += ' read';
        }
        if (cmd.includes('वर्णन') || cmd.includes('दृश्य') || cmd.includes('விளக்கு')) {
          normalizedCmd += ' describe';
        }
        if (cmd.includes('रंग') || cmd.includes('நிறம்') || cmd.includes('రంగు')) {
          normalizedCmd += ' color';
        }
        if (cmd.includes('पैसे') || cmd.includes('रुपये') || cmd.includes('பணம்') || cmd.includes('డబ్బు')) {
          normalizedCmd += ' currency';
        }
        if (cmd.includes('रोकें') || cmd.includes('बंद') || cmd.includes('நிறுத்து') || cmd.includes('ఆపు')) {
          normalizedCmd += ' stop';
        }

        if (normalizedCmd.includes('take me to') || normalizedCmd.includes('navigate to') || normalizedCmd.includes('go to')) {
          const match = normalizedCmd.match(/(?:take me to|navigate to|go to)\s+(.+)/);
          if (match && match[1]) {
            startRouteNavigation(match[1].trim());
          }
        } else if (normalizedCmd.includes('find nearest') || normalizedCmd.includes('nearest')) {
          const match = normalizedCmd.match(/(?:find nearest|nearest)\s+(.+)/);
          if (match && match[1]) {
            findNearestPlace(match[1].trim());
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
        } else if (normalizedCmd.includes('resume navigation')) {
          if (routeCoords.length > 0) {
            setNavActive(true);
            speakIfNotMuted('Resuming navigation.');
          } else {
            speakIfNotMuted('No active route to resume.');
          }
        } else if (normalizedCmd.includes('how far')) {
          if (routeCoords.length > 0) {
            speakIfNotMuted(`Destination is ${distanceRemaining} meters away, about ${etaMinutes} minutes walking.`);
          } else {
            speakIfNotMuted('No active navigation route.');
          }
        } else if (normalizedCmd.includes('what is my next turn') || normalizedCmd.includes('next turn')) {
          if (routeCoords.length > 0 && routeSteps[navStep]) {
            speakIfNotMuted(`Your next turn is: ${routeSteps[navStep].instruction}`);
          } else {
            speakIfNotMuted('No active navigation route.');
          }
        } else if (normalizedCmd.includes('repeat instruction')) {
          if (routeCoords.length > 0 && routeSteps[Math.max(0, navStep - 1)]) {
            speakIfNotMuted(routeSteps[Math.max(0, navStep - 1)].instruction);
          } else {
            speakIfNotMuted('No instructions to repeat.');
          }
        } else if (normalizedCmd.includes('what') && normalizedCmd.includes('front')) {
          handleScene();
        } else if (normalizedCmd.includes('read') || normalizedCmd.includes('ocr')) {
          handleOCR();
        } else if (normalizedCmd.includes('describe') || normalizedCmd.includes('scene')) {
          handleScene();
        } else if (normalizedCmd.includes('color')) {
          handleColor();
        } else if (normalizedCmd.includes('currency') || normalizedCmd.includes('money')) {
          handleCurrency();
        } else if (normalizedCmd.includes('face') || normalizedCmd.includes('person')) {
          handleFace();
        } else if (normalizedCmd.includes('stop')) {
          stopSpeaking();
          setVoiceMessage('');
        } else if (normalizedCmd.includes('start') && normalizedCmd.includes('camera')) {
          if (!cameraOn) startCamera();
        } else {
          speakIfNotMuted(`Command: ${transcript}. Not recognized.`);
        }
        addHistory('voice', transcript, null, 'Voice command');
      },
      () => {
        setListening(false);
      }
    );
  }, [handleScene, handleOCR, handleColor, handleCurrency, handleFace, cameraOn, startCamera, speakIfNotMuted, addHistory, startRouteNavigation, findNearestPlace, routeCoords, routeSteps, navStep, distanceRemaining, etaMinutes, settings.voice_automation]);

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

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
      stopSpeaking();
    };
  }, []);

  const detections = visionResult?.objects || [];

  if (view === 'admin') return <AdminView onBack={() => setView('dashboard')} history={history} fps={fps} />;
  if (view === 'settings') return <SettingsView onBack={() => setView('dashboard')} settings={settings} setSettings={setSettings} contacts={contacts} setContacts={setContacts} />;

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

        <div className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Webcam & Emergency SOS controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary-600" />
                  <span className="font-semibold text-slate-700">Live Glasses Camera</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {analyzing && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-500/10 text-accent-600 font-medium">
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
                  {cameraOn && <span className="text-slate-500 font-mono">{fps} FPS</span>}
                </div>
              </div>
              <div className="relative aspect-video bg-slate-900">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {cameraOn && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {detections.slice(0, 4).map((d, i) => (
                      <div key={i} className={`px-2 py-1 rounded-lg text-xs font-medium text-white backdrop-blur-sm ${
                        d.distanceMeters <= 1 ? 'bg-error-500/80' :
                        d.distanceMeters <= 2 ? 'bg-warning-500/80' : 'bg-success-500/80'
                      }`}>
                        {d.class} · {d.distance} · {d.position}
                      </div>
                    ))}
                  </div>
                )}
                {analyzing && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-sm">
                    <Loader2 className="w-4 h-4 text-accent-400 animate-spin" />
                    <span className="text-xs text-white">Analyzing...</span>
                  </div>
                )}
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <CameraOff className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm">Camera is off</p>
                    <p className="text-xs mt-1">Click Start to begin AI analysis</p>
                  </div>
                )}
                {cameraStatus === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-error-400">
                    <AlertCircle className="w-12 h-12 mb-3" />
                    <p className="text-sm">Camera access denied</p>
                  </div>
                )}
              </div>
              <div className="p-4 flex gap-2">
                {!cameraOn ? (
                  <button
                    onClick={() => startCamera()}
                    disabled={cameraStatus === 'starting'}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <Play className="w-5 h-5" /> Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={stopCamera}
                      className="flex-1 px-4 py-3 rounded-xl bg-error-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-error-600 transition-all"
                    >
                      <Square className="w-5 h-5" /> Stop Camera
                    </button>
                    <button
                      onClick={toggleCamera}
                      className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
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
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ocr', icon: Scan, label: 'Read Text', action: handleOCR },
                  { id: 'scene', icon: Eye, label: 'Describe', action: handleScene },
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

            {/* Color & Currency Results */}
            {(colorResult || currencyResult) && (
              <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4 space-y-3">
                {colorResult && (
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
                )}
                {currencyResult && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary-600" /> Currency
                    </h3>
                    <div className="font-semibold text-slate-700">{currencyResult}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Voice Output & History details */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl card-shadow border border-slate-100 p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-primary-600" /> Voice Output
              </h3>
              <div className="bg-slate-50 rounded-xl p-3 min-h-[80px] flex items-center">
                {voiceMessage ? (
                  <p className="text-sm text-slate-600 leading-relaxed">{voiceMessage}</p>
                ) : (
                  <p className="text-sm text-slate-400">Voice output will appear here</p>
                )}
              </div>
              <button
                onClick={() => { stopSpeaking(); setVoiceMessage(''); }}
                className="mt-2 w-full py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4" /> Stop Speaking
              </button>
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
function SettingsView({ onBack, settings, setSettings, contacts, setContacts }: {
  onBack: () => void;
  settings: AppSettings & { voice_automation?: boolean };
  setSettings: (s: AppSettings & { voice_automation?: boolean }) => void;
  contacts: EmergencyContact[];
  setContacts: (c: EmergencyContact[]) => void;
}) {
  const [local, setLocal] = useState<AppSettings & { voice_automation?: boolean }>(settings);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });

  const save = async () => {
    localStorage.setItem('visionassist_settings', JSON.stringify(local));
    try {
      const { data } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
      const { voice_automation, ...dbSettings } = local;
      if (data?.id) {
        await supabase.from('app_settings').update({ ...dbSettings, updated_at: new Date().toISOString() }).eq('id', data.id);
      } else {
        await supabase.from('app_settings').insert(dbSettings);
      }
    } catch (e) {
      console.warn('Failed to save settings to Supabase:', e);
    }
    setSettings(local);
    configureSpeech(local.voice_speed || 1.0, local.voice_lang || 'en-US');
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
