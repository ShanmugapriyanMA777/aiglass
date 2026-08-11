/* eslint-disable @typescript-eslint/no-explicit-any */
let currentSettings = { speed: 1.0, lang: 'en-US', pitch: 1.0, volume: 1.0 };
let activeAudio: HTMLAudioElement | null = null;

// Translation mappings for regional Indian languages
const translations: Record<string, Record<string, string>> = {
  hi: {
    "camera started. analyzing your surroundings.": "कैमरा शुरू हो गया है। आपके परिवेश का विश्लेषण किया जा रहा है।",
    "reading text.": "पाठ पढ़ा जा रहा है।",
    "no text found.": "कोई पाठ नहीं मिला।",
    "text recognition failed.": "पाठ पहचानना विफल रहा।",
    "scene description failed.": "दृश्य विवरण विफल रहा।",
    "color recognition failed.": "रंग पहचान विफल रही।",
    "checking currency.": "मुद्रा की जाँच की जा रही है।",
    "no currency detected.": "कोई मुद्रा नहीं मिली।",
    "currency recognition failed.": "मुद्रा पहचान विफल रही।",
    "no person detected.": "कोई व्यक्ति नहीं मिला।",
    "face recognition failed.": "चेहरा पहचानना विफल रहा।",
    "voice recognition not supported in this browser.": "इस ब्राउज़र में आवाज़ पहचानना समर्थित नहीं है।",
    "navigation stopped.": "नेविगेशन बंद कर दिया गया है।",
    "navigation paused.": "नेविगेशन रोक दिया गया है।",
    "resuming navigation.": "नेविगेशन फिर से शुरू किया जा रहा है।",
    "no active route to resume.": "फिर से शुरू करने के लिए कोई सक्रिय मार्ग नहीं है।",
    "no active navigation route.": "कोई सक्रिय नेविगेशन मार्ग नहीं है।",
    "no instructions to repeat.": "दोहराने के लिए कोई निर्देश नहीं हैं।",
    "emergency activated. location shared. calling emergency contact.": "आपातकाल सक्रिय किया गया। स्थान साझा किया गया। आपातकालीन संपर्क को कॉल किया जा रहा है।",
    "emergency alert sent. location unavailable.": "आपातकालीन चेतावनी भेजी गई। स्थान अनुपलब्ध है।",
    "walk forward.": "आगे चलें।",
    "turn left.": "बाएं मुड़ें।",
    "turn right.": "दाएं मुड़ें।",
    "start walking.": "चलना शुरू करें।",
    "you have reached your destination.": "आप अपने गंतव्य पर पहुंच गए हैं।",
    "camera is starting...": "कैमरा शुरू हो रहा है...",
    "searching walking route to": "सड़क मार्ग खोजा जा रहा है: ",
    "searching nearest": "निकटतम खोजा जा रहा है: ",
    "very close": "बहुत पास",
    "person": "व्यक्ति",
    "chair": "कुर्सी",
    "laptop": "लैपटॉप",
    "backpack": "बैग",
    "bottle": "बोतल",
    "water bottle": "पानी की बोतल",
    "doorway": "दरवाजा",
    "cup": "कप",
    "cell phone": "फ़ोन",
    "dog": "कुत्ता",
    "cat": "बिल्ली",
    "car": "कार",
    "bicycle": "साइकिल",
    "book": "किताब",
    "spectacles": "चश्मा",
    "table": "मेज",
    "money": "पैसा",
    "navy blue": "नेवी ब्लू",
    "white": "सफेद",
    "forest green": "हरा",
    "soft gray": "धूसर",
    "crimson red": "लाल",
    "red": "लाल",
    "gold": "सुनहरा",
    "rupees": "रुपये"
  },
  ta: {
    // === Core UI phrases ===
    "camera started. analyzing your surroundings.": "கேமரா தொடங்கப்பட்டது. உங்கள் சூழலை பகுப்பாய்வு செய்கிறது.",
    "reading text.": "உரையைப் படிக்கிறது.",
    "no text found.": "உரை எதுவும் கிடைக்கவில்லை.",
    "text recognition failed.": "உரையை கண்டறிவதில் தோல்வி.",
    "scene description failed.": "காட்சி விளக்கம் தோல்வியடைந்தது.",
    "color recognition failed.": "நிறத்தை கண்டறிவதில் தோல்வி.",
    "checking currency.": "பணத்தை சரிபார்க்கிறது.",
    "no currency detected.": "பணம் எதுவும் கண்டறியப்படவில்லை.",
    "currency recognition failed.": "பணத்தை கண்டறிவதில் தோல்வி.",
    "no person detected.": "நபர் யாரும் கண்டறியப்படவில்லை.",
    "face recognition failed.": "முகம் கண்டறிவதில் தோல்வி.",
    "voice recognition not supported in this browser.": "இந்த உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை.",
    "navigation stopped.": "வழிசெலுத்தல் நிறுத்தப்பட்டது.",
    "navigation paused.": "வழிசெலுத்தல் இடைநிறுத்தப்பட்டது.",
    "resuming navigation.": "வழிசெலுத்தலைத் தொடர்கிறது.",
    "no active route to resume.": "தொடர எந்த ஒரு வழியும் இல்லை.",
    "no active navigation route.": "செயலில் உள்ள வழி எதுவுமில்லை.",
    "no instructions to repeat.": "மீண்டும் சொல்ல எந்த வழிமுறைகளும் இல்லை.",
    "emergency activated. location shared. calling emergency contact.": "அவசரநிலை செயல்படுத்தப்பட்டது. இருப்பிடம் பகிரப்பட்டது. அவசர தொடர்பை அழைக்கிறது.",
    "emergency alert sent. location unavailable.": "அவசர எச்சரிக்கை அனுப்பப்பட்டது. இருப்பிடம் கிடைக்கவில்லை.",
    "walk forward.": "முன்னோக்கி நடக்கவும்.",
    "turn left.": "இடதுபுறம் திரும்பவும்.",
    "turn right.": "வலதுபுறம் திரும்பவும்.",
    "start walking.": "நடக்க தொடங்குங்கள்.",
    "you have reached your destination.": "நீங்கள் இலக்கை அடைந்துவிட்டீர்கள்.",
    "camera is starting...": "கேமரா தொடங்குகிறது...",
    "searching walking route to": "நடக்கும் வழியைத் தேடுகிறது: ",
    "searching nearest": "அருகிலுள்ளதைத் தேடுகிறது: ",

    // === Dynamic speech phrases (these were missing and caused English speech) ===
    "let me read that for you.": "நான் உங்களுக்காக படிக்கிறேன்.",
    "my camera is on! i am taking a look around for you.": "என் கேமரா ஆன் செய்யப்பட்டுள்ளது! உங்களுக்காக நான் சுற்றிப் பார்க்கிறேன்.",
    "let me see what objects are around us.": "நம்மைச் சுற்றி என்ன பொருட்கள் இருக்கின்றன என்று பார்க்கிறேன்.",
    "no objects detected.": "எந்த பொருளும் கண்டறியப்படவில்லை.",
    "object detection failed.": "பொருள் கண்டறிதல் தோல்வியடைந்தது.",
    "please start the camera first.": "முதலில் கேமராவை ஆன் செய்யுங்கள்.",
    "stopped currency scanning.": "பண ஸ்கேனிங் நிறுத்தப்பட்டது.",
    "i am ready to check your currency! just hold a note or coin up to the camera for me.": "நான் உங்கள் பணத்தை சரிபார்க்க தயாராக இருக்கிறேன்! ஒரு நோட்டு அல்லது நாணயத்தை கேமரா முன் காட்டுங்கள்.",
    "i'm listening, how can i help you?": "நான் கேட்கிறேன், நான் உங்களுக்கு எப்படி உதவ முடியும்?",
    "i'm listening.": "நான் கேட்கிறேன்.",
    "automatic voice control disabled.": "தானியங்கி குரல் கட்டுப்பாடு முடக்கப்பட்டுள்ளது.",
    "sorry, i could not reach the ai service at the moment.": "மன்னிக்கவும், தற்போது AI சேவையை அணுக இயலவில்லை.",
    "analyzing your surroundings. please wait.": "உங்கள் சூழலை ஆராய்கிறேன். தயவுசெய்து காத்திருங்கள்.",
    "simulated route deviation.": "வழி மாற்றம் உருவகப்படுத்தப்பட்டது.",
    "great job, we have safely reached your destination!": "மிகவும் நன்றாக, நாம் பாதுகாப்பாக இலக்கை அடைந்துவிட்டோம்!",
    "it looks like we took a slight detour. let me calculate a new path for us.": "நாம் சிறிது வழி மாறிவிட்டோம் போலிருக்கிறது. புதிய பாதையை கணக்கிடுகிறேன்.",
    "it looks like you may have fallen. are you okay?": "நீங்கள் கீழே விழுந்துவிட்டீர்கள் போல் தெரிகிறது. நீங்கள் நலமா?",
    "glad to hear you are okay. let me know if you need anything.": "நீங்கள் நலம் என்பதில் மகிழ்ச்சி. ஏதாவது தேவைப்பட்டால் சொல்லுங்கள்.",
    "reading signs.": "அடையாளங்களைப் படிக்கிறேன்.",
    "no text or signs detected.": "எழுத்து அல்லது அடையாளங்கள் எதுவும் கண்டறியப்படவில்லை.",
    "home address is not configured. please add it in settings.": "வீட்டு முகவரி அமைக்கப்படவில்லை. அமைப்புகளில் சேர்க்கவும்.",
    "college address is not configured. please add it in settings.": "கல்லூரி முகவரி அமைக்கப்படவில்லை. அமைப்புகளில் சேர்க்கவும்.",
    "favorite destination is not configured. please add it in settings.": "விருப்ப இடம் அமைக்கப்படவில்லை. அமைப்புகளில் சேர்க்கவும்.",
    "please specify a place to navigate.": "வழிசெலுத்த ஒரு இடத்தைக் குறிப்பிடுங்கள்.",

    // === Position words for obstacle alerts ===
    "in front of you": "உங்கள் முன்",
    "on your left": "உங்கள் இடதுபுறம்",
    "on your right": "உங்கள் வலதுபுறம்",
    "right in front of you": "உங்கள் நேர் முன்",
    "very close": "மிக அருகில்",
    "meters away": "மீட்டர் தொலைவில்",
    "and it's very close!": "மிக அருகில் உள்ளது!",

    // === Object names ===
    "person": "நபர்",
    "chair": "நாற்காலி",
    "laptop": "லேப்டாப்",
    "backpack": "பை",
    "bottle": "பாட்டில்",
    "water bottle": "தண்ணீர் பாட்டில்",
    "doorway": "வாசல்",
    "cup": "கப்",
    "cell phone": "தொலைபேசி",
    "dog": "நாய்",
    "cat": "பூனை",
    "car": "கார்",
    "bus": "பேருந்து",
    "truck": "லாரி",
    "motorcycle": "மோட்டார் சைக்கிள்",
    "bicycle": "மிதிவண்டி",
    "book": "புத்தகம்",
    "spectacles": "கண்ணாடி",
    "table": "மேஜை",
    "money": "பணம்",
    "tv": "தொலைக்காட்சி",
    "mouse": "மவுஸ்",
    "keyboard": "விசைப்பலகை",
    "remote": "ரிமோட்",
    "couch": "சோபா",
    "bed": "கட்டில்",
    "dining table": "சாப்பாட்டு மேஜை",
    "toilet": "கழிவறை",
    "sink": "சிங்க்",
    "refrigerator": "குளிர்சாதனப்பெட்டி",
    "oven": "அடுப்பு",
    "microwave": "மைக்ரோவேவ்",
    "scissors": "கத்தரிக்கோல்",
    "clock": "கடிகாரம்",
    "vase": "பூச்சாடி",
    "umbrella": "குடை",
    "handbag": "கைப்பை",
    "suitcase": "சூட்கேஸ்",
    "tie": "டை",
    "stop sign": "நிறுத்த அடையாளம்",
    "traffic light": "போக்குவரத்து விளக்கு",
    "bench": "பெஞ்ச்",

    // === Color names ===
    "navy blue": "நேவி நீலம்",
    "white": "வெள்ளை",
    "black": "கருப்பு",
    "forest green": "பச்சை",
    "soft gray": "சாம்பல்",
    "gray": "சாம்பல்",
    "crimson red": "சிவப்பு",
    "red": "சிவப்பு",
    "blue": "நீலம்",
    "green": "பச்சை",
    "yellow": "மஞ்சள்",
    "orange": "ஆரஞ்சு",
    "pink": "இளஞ்சிவப்பு",
    "purple": "ஊதா",
    "brown": "பழுப்பு",
    "gold": "தங்கம்",
    "silver": "வெள்ளி",
    "rupees": "ரூபாய்",
    "beige": "பழுப்பு வெள்ளை",
    "maroon": "கருஞ்சிவப்பு",
    "cream": "கிரீம்",
    "teal": "டீல்"
  },
  te: {
    "camera started. analyzing your surroundings.": "కెమెరా ప్రారంభించబడింది. మీ పరిసరాలను విశ్లేషిస్తోంది.",
    "reading text.": "టెక్స్ట్ చదువుతోంది.",
    "no text found.": "టెక్స్ట్ ఏదీ కనుగొనబడలేదు.",
    "text recognition failed.": "టెక్స్ట్ గుర్తింపు విఫలమైంది.",
    "scene description failed.": "దృశ్య వివరణ విఫలమైంది.",
    "color recognition failed.": "రంగు గుర్తింపు విఫలమైంది.",
    "checking currency.": "కరెన్సీని తనిఖీ చేస్తోంది.",
    "no currency detected.": "కరెన్సీ ఏదీ కనుగొనబడలేదు.",
    "currency recognition failed.": "కరెన్సీ గుర్తింపు విఫలమైంది.",
    "no person detected.": "ఎవరూ గుర్తించబడలేదు.",
    "face recognition failed.": "ముఖ గుర్తింపు విఫలమైంది.",
    "voice recognition not supported in this browser.": "ఈ బ్రౌజర్‌లో వాయిస్ రికగ్నిషన్ సపోర్ట్ చేయబడదు.",
    "navigation stopped.": "నావిగేషన్ నిలిపివేయబడింది.",
    "navigation paused.": "నావిగేషన్ తాత్కాలికంగా నిలిపివేయబడింది.",
    "resuming navigation.": "నావిగేషన్ పునఃప్రారంభించబడుతోంది.",
    "no active route to resume.": "పునఃప్రారంభించడానికి క్రియాశీల మార్గం లేదు.",
    "no active navigation route.": "క్రియాశీల నావిగేషన్ మార్గం లేదు.",
    "no instructions to repeat.": "పునరావృతం చేయడానికి సూచనలు లేవు.",
    "emergency activated. location shared. calling emergency contact.": "అత్యవసర పరిస్థితి సక్రియం చేయబడింది. లొకేషన్ షేర్ చేయబడింది. ఎమర్జెన్సీ కాంటాక్ట్‌కు కాల్ చేస్తోంది.",
    "emergency alert sent. location unavailable.": "అత్యవసర హెచ్చరిక పంపబడింది. స్థానం అందుబాటులో లేదు.",
    "walk forward.": "ముందుకు నడవండి.",
    "turn left.": "ఎడమ వైపు తిరగండి.",
    "turn right.": "కుడి వైపు తిరగండి.",
    "start walking.": "నడవడం ప్రారంభించండి.",
    "you have reached your destination.": "మీరు మీ గమ్యాన్ని చేరుకున్నారు.",
    "camera is starting...": "కెమెరా ప్రారంభమవుతోంది...",
    "searching walking route to": "నడక మార్గాన్ని శోధిస్తోంది: ",
    "searching nearest": "సమీప శోధిస్తోంది: ",
    "very close": "చాలా దగ్గరగా",
    "person": "వ్యక్తి",
    "chair": "కుర్చీ",
    "laptop": "ల్యాప్‌టాప్",
    "backpack": "బ్యాగ్",
    "bottle": "బాటిల్",
    "water bottle": "నీళ్ల బాటిల్",
    "doorway": "ద్వారం",
    "cup": "కప్పు",
    "cell phone": "ఫోన్",
    "dog": "కుక్క",
    "cat": "పిల్లి",
    "car": "கారు",
    "bicycle": "సైకిల్",
    "book": "పుస్తకం",
    "spectacles": "అద్దాలు",
    "table": "బల్ల",
    "money": "డబ్బు",
    "navy blue": "నేవీ బ్లూ",
    "white": "తెలుపు",
    "forest green": "ఆకుపచ్చ",
    "soft gray": "బూడిద రంగు",
    "crimson red": "ఎరుపు",
    "red": "ఎరుపు",
    "gold": "బంగారు రంగు",
    "rupees": "రూపాయలు"
  },
  kn: {
    "camera started. analyzing your surroundings.": "ಕ್ಯಾಮರಾ ಪ್ರಾರಂಭವಾಗಿದೆ. ನಿಮ್ಮ ಸುತ್ತಮುತ್ತಲಿನ ಪ್ರದೇಶವನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ.",
    "reading text.": "ಪಠ್ಯವನ್ನು ಓದಲಾಗುತ್ತಿದೆ.",
    "no text found.": "ಯಾವುದೇ ಪಠ್ಯ ಕಂಡುಬಂದಿಲ್ಲ.",
    "text recognition failed.": "ಪಠ್ಯ ಗುರುತಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ.",
    "scene description failed.": "ದೃಶ್ಯ ವಿವರಣೆ ವಿಫಲವಾಗಿದೆ.",
    "color recognition failed.": "ಬಣ್ಣ ಗುರುತಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ.",
    "checking currency.": "ಕರೆನ್ಸಿ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ.",
    "no currency detected.": "ಯಾವುದೇ ಕರೆನ್ಸಿ ಪತ್ತೆಯಾಗಿಲ್ಲ.",
    "currency recognition failed.": "ಕರೆನ್ಸಿ ಗುರುತಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ.",
    "no person detected.": "ಯಾರೂ ಪತ್ತೆಯಾಗಿಲ್ಲ.",
    "face recognition failed.": "ಮುಖ ಗುರುತಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ.",
    "voice recognition not supported in this browser.": "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ.",
    "navigation stopped.": "ನ್ಯಾವಿಗೇಷನ್ ನಿಲ್ಲಿಸಲಾಗಿದೆ.",
    "navigation paused.": "ನ್ಯಾವಿಗೇಷನ್ ವಿರಾಮಗೊಳಿಸಲಾಗಿದೆ.",
    "resuming navigation.": "ನ್ಯಾವಿಗೇಷನ್ ಪುನರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ.",
    "no active route to resume.": "ಪುನರಾರಂಭಿಸಲು ಯಾವುದೇ ಸಕ್ರಿಯ ಮಾರ್ಗವಿಲ್ಲ.",
    "no active navigation route.": "ಯಾವುದೇ ಸಕ್ರಿಯ ನ್ಯಾವಿಗೇಷನ್ ಮಾರ್ಗವಿಲ್ಲ.",
    "no instructions to repeat.": "ಪುನರಾವರ್ತಿಸಲು ಯಾವುದೇ ಸೂಚನೆಗಳಿಲ್ಲ.",
    "emergency activated. location shared. calling emergency contact.": "ತುರ್ತು ಪರಿಸ್ಥಿತಿ ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ. ಸ್ಥಳವನ್ನು ಹಂಚಿಕೊಳ್ಳಲಾಗಿದೆ. ತುರ್ತು ಸಂಪರ್ಕಕ್ಕೆ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ.",
    "emergency alert sent. location unavailable.": "ತುರ್ತು ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಲಾಗಿದೆ. ಸ್ಥಳ ಲಭ್ಯವಿಲ್ಲ.",
    "walk forward.": "ಮುಂದೆ ನಡೆಯಿರಿ.",
    "turn left.": "ಎಡಕ್ಕೆ ತಿರುಗಿ.",
    "turn right.": "ಬಲಕ್ಕೆ ತಿರುಗಿ.",
    "start walking.": "ನಡೆಯಲು ಪ್ರಾರಂಭಿಸಿ.",
    "you have reached your destination.": "ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನವನ್ನು ನೀವು ತಲುಪಿದ್ದೀರಿ.",
    "camera is starting...": "ಕ್ಯಾಮರಾ ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ...",
    "searching walking route to": "ನಡಿಗೆಯ ಮಾರ್ಗವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ: ",
    "searching nearest": "ಹತ್ತಿರದ ಹುಡುಕಲಾಗುತ್ತಿದೆ: ",
    "very close": "ಬಹಳ ಹತ್ತಿರದಲ್ಲಿ",
    "person": "ವ್ಯಕ್ತಿ",
    "chair": "ಕುರ್ಚಿ",
    "laptop": "ಲ್ಯಾಪ್‌ಟಾಪ್",
    "backpack": "ಬ್ಯಾಗ್",
    "bottle": "ಬಾಟಲಿ",
    "water bottle": "ನೀರಿನ ಬಾಟಲಿ",
    "doorway": "ದ್ವಾರ",
    "cup": "ಕಪ್",
    "cell phone": "ಫೋನ್",
    "dog": "ನಾಯಿ",
    "cat": "ಬೆಕ್ಕು",
    "car": "ಕಾರು",
    "bicycle": "ಸೈಕಲ್",
    "book": "ಪುಸ್ತಕ",
    "spectacles": "ಕನ್ನಡಕ",
    "table": "ಮೇಜು",
    "money": "ಹಣ",
    "navy blue": "ನೇವಿ ಬ್ಲೂ",
    "white": "ಬಿಳಿ",
    "forest green": "ಹಸಿರು",
    "soft gray": "ಬೂದು ಬಣ್ಣ",
    "crimson red": "ಕೆಂಪು",
    "red": "ಕೆಂಪು",
    "gold": "ಚಿನ್ನದ ಬಣ್ಣ",
    "rupees": "ರೂಪಾಯಿಗಳು"
  }
};

function translateDirections(text: string, lang: string): string {
  let res = text.toLowerCase();
  const dict = translations[lang];
  if (!dict) return text;
  
  if (res.includes("walk forward")) res = res.replace("walk forward", dict["walk forward."] || "आगे चलें");
  if (res.includes("turn left")) res = res.replace("turn left", dict["turn left."] || "बाएं मुड़ें");
  if (res.includes("turn right")) res = res.replace("turn right", dict["turn right."] || "दाएं मुड़ें");
  if (res.includes("meters")) res = res.replace("meters", lang === 'hi' ? "मीटर" : lang === 'ta' ? "மீட்டர்" : lang === 'te' ? "మీటర్లు" : "ಮೀಟರ್");
  if (res.includes("meter")) res = res.replace("meter", lang === 'hi' ? "मीटर" : lang === 'ta' ? "மீட்டர்" : lang === 'te' ? "మీటర్" : "ಮೀಟರ್");
  return res;
}

export function translateText(text: string, langCode: string): string {
  const shortLang = langCode.split('-')[0].toLowerCase();
  if (shortLang === 'en') return text;

  const dict = translations[shortLang];
  if (!dict) return text;

  const trimmed = text.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  // Exact Match
  if (dict[lowerTrimmed]) return dict[lowerTrimmed];

  let translated = text;

  // Emergency Routing
  if (translated.startsWith("Routing emergency navigation to closest hospital:")) {
    const hosp = translated.replace("Routing emergency navigation to closest hospital:", "").trim();
    if (shortLang === 'hi') return `निकटतम अस्पताल ${hosp} के लिए आपातकालीन मार्ग खोजा जा रहा है।`;
    if (shortLang === 'ta') return `அருகிலுள்ள மருத்துவமனை ${hosp} க்கான அவசர வழி கண்டறியப்படுகிறது.`;
    if (shortLang === 'te') return `సమీప ఆసుపత్రి ${hosp} కి అత్యవసర నావిగేషన్‌ను రూట్ చేస్తోంది.`;
    if (shortLang === 'kn') return `ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ${hosp} ಗೆ ತುರ್ತು ನ್ಯಾವಿಗೇಷನ್ ಮಾರ್ಗವನ್ನು ಹೊಂದಿಸಲಾಗುತ್ತಿದೆ.`;
  }

  // Navigation ETA
  const navMatch = translated.match(/Destination is (\d+) meters away, about (\d+) minutes walking\./i);
  if (navMatch) {
    const meters = navMatch[1];
    const mins = navMatch[2];
    if (shortLang === 'hi') return `गंतव्य ${meters} मीटर दूर है, लगभग ${mins} मिनट की पैदल दूरी पर।`;
    if (shortLang === 'ta') return `இலக்கு ${meters} மீட்டர் தொலைவில் உள்ளது, சுமார் ${mins} நிமிடங்கள் நடைபயணம்.`;
    if (shortLang === 'te') return `గమ్యస్థానం ${meters} మీటర్ల దూరంలో ఉంది, నడవడానికి సుమారు ${mins} నిమిషాలు పడుతుంది.`;
    if (shortLang === 'kn') return `ಗಮ್ಯಸ್ಥಾನವು ${meters} ಮೀಟರ್ ದೂರದಲ್ಲಿದೆ, ಸುಮಾರು ${mins} ನಿಮಿಷಗಳ ನಡಿಗೆ.`;
  }

  // Next Turn
  if (translated.startsWith("Your next turn is:")) {
    const turn = translated.replace("Your next turn is:", "").trim();
    const translatedTurn = translateDirections(turn, shortLang);
    if (shortLang === 'hi') return `आपका अगला मोड़ है: ${translatedTurn}`;
    if (shortLang === 'ta') return `உங்கள் அடுத்த திருப்பம்: ${translatedTurn}`;
    if (shortLang === 'te') return `మీ తదుపరి మలుపు: ${translatedTurn}`;
    if (shortLang === 'kn') return `ನಿಮ್ಮ ಮುಂದಿನ ತಿರುವು: ${translatedTurn}`;
  }

  // "This is X."
  if (translated.startsWith("This is ") && (translated.endsWith(".") || translated.endsWith("!"))) {
    const item = translated.substring(8, translated.length - 1).trim();
    const transItem = dict[item.toLowerCase()] || item;
    if (shortLang === 'hi') return `यह ${transItem} है।`;
    if (shortLang === 'ta') return `இது ${transItem}.`;
    if (shortLang === 'te') return `ఇది ${transItem}.`;
    if (shortLang === 'kn') return `ಇದು ${transItem}.`;
  }

  // "The main color is X."
  if (translated.startsWith("The main color is ") && translated.endsWith(".")) {
    const col = translated.substring(18, translated.length - 1).trim();
    const transCol = dict[col.toLowerCase()] || col;
    if (shortLang === 'hi') return `मुख्य रंग ${transCol} है।`;
    if (shortLang === 'ta') return `முக்கிய நிறம் ${transCol} ஆகும்.`;
    if (shortLang === 'te') return `முக்கியమైన రంగు ${transCol}.`;
    if (shortLang === 'kn') return `ಮುಖ್ಯ ಬಣ್ಣ ${transCol}.`;
  }

  // Obstacle warning: "Warning: X is very close at Y meters"
  const warnMatch = translated.match(/Warning: (.+?) is very close at ([\d\.]+) meters/i);
  if (warnMatch) {
    const objName = warnMatch[1].toLowerCase();
    const dist = warnMatch[2];
    const transObj = dict[objName] || objName;
    if (shortLang === 'hi') return `चेतावनी: ${transObj} ${dist} मीटर पर बहुत पास है।`;
    if (shortLang === 'ta') return `எச்சரிக்கை: ${transObj} ${dist} மீட்டர் தொலைவில் மிக அருகில் உள்ளது.`;
    if (shortLang === 'te') return `హెచ్చరిక: ${transObj} ${dist} మీటర్ల వద్ద చాలా దగ్గరగా ఉంది.`;
    if (shortLang === 'kn') return `ಎಚ್ಚರಿಕೆ: ${transObj} ${dist} ಮೀಟರ್‌ನಲ್ಲಿ ಬಹಳ ಹತ್ತಿರದಲ್ಲಿದೆ.`;
  }

  // Object detection phrase: "chair in front of you, 1.2 meters away."
  const objMatch = translated.match(/(.+?) (in front of you|on your left|on your right|center|left|right), ([\d\.]+ meters away|very close)/i);
  if (objMatch) {
    const objName = objMatch[1].toLowerCase().trim();
    const pos = objMatch[2].toLowerCase();
    const dist = objMatch[3].toLowerCase();

    const posMapTa: Record<string, string> = {
      'in front of you': 'உங்கள் முன்',
      'on your left': 'உங்கள் இடதுபுறம்',
      'on your right': 'உங்கள் வலதுபுறம்',
      'center': 'உங்கள் முன்',
      'left': 'உங்கள் இடதுபுறம்',
      'right': 'உங்கள் வலதுபுறம்'
    };
    const transObj = dict[objName] || objName;
    const transPos = (shortLang === 'ta' ? posMapTa[pos] : null) || dict[pos] || pos;
    
    let transDist = dist;
    if (dist.includes("meters away")) {
      const num = dist.replace("meters away", "").trim();
      if (shortLang === 'hi') transDist = `${num} मीटर दूर`;
      else if (shortLang === 'ta') transDist = `${num} மீட்டர் தொலைவில்`;
      else if (shortLang === 'te') transDist = `${num} మీటర్ల దూరంలో`;
      else if (shortLang === 'kn') transDist = `${num} ಮೀಟರ್ ದೂರದಲ್ಲಿ`;
    } else if (dist === "very close") {
      transDist = dict["very close"] || dist;
    }

    if (shortLang === 'hi') return `${transObj} ${transPos}, ${transDist} है।`;
    if (shortLang === 'ta') return `${transPos} ஒரு ${transObj}, ${transDist} உள்ளது.`;
    if (shortLang === 'te') return `${transObj} ${transPos}, ${transDist} ఉంది.`;
    if (shortLang === 'kn') return `${transObj} ${transPos}, ${transDist} ಇದೆ.`;
  }

  // Heuristic scene fallback pattern: "I can see a chair on your left."
  if (translated.toLowerCase().startsWith("i can see ")) {
    if (shortLang === 'ta') {
      const text = translated
        .replace(/I can see /i, '')
        .replace(/\./g, '')
        .replace(/on your left/gi, 'உங்கள் இடதுபுறம்')
        .replace(/on your right/gi, 'உங்கள் வலதுபுறம்')
        .replace(/on your front/gi, 'உங்கள் முன்')
        .replace(/in front of you/gi, 'உங்கள் முன்')
        .replace(/\ba\b/gi, 'ஒரு')
        .replace(/, and /gi, ', மற்றும் ');
      return `${text} உள்ளது.`;
    }
  }

  // Currency pattern: "This is a 500 rupees note"
  const currMatch = translated.match(/This is a (.+)/i);
  if (currMatch) {
    const rawVal = currMatch[1].trim();
    const transVal = dict[rawVal.toLowerCase()] || rawVal;
    if (shortLang === 'ta') return `இது ஒரு ${transVal} ஆகும்.`;
    if (shortLang === 'hi') return `यह ${transVal} है।`;
    if (shortLang === 'te') return `ఇది ${transVal}.`;
    if (shortLang === 'kn') return `இது ${transVal}.`;
  }

  // Search routing / place confirmations
  if (translated.startsWith("Searching nearest ")) {
    const term = translated.replace("Searching nearest ", "").trim();
    const transTerm = dict[term.toLowerCase()] || term;
    return (dict["searching nearest"] || "Searching nearest ") + transTerm;
  }
  if (translated.startsWith("Searching walking route to ")) {
    const term = translated.replace("Searching walking route to ", "").trim();
    const transTerm = dict[term.toLowerCase()] || term;
    return (dict["searching walking route to"] || "Searching walking route to ") + transTerm;
  }

  // Command: X. Not recognized.
  const cmdMatch = translated.match(/Command: (.+?)\. Not recognized\./i);
  if (cmdMatch) {
    const transcriptText = cmdMatch[1];
    if (shortLang === 'hi') return `आदेश: ${transcriptText}। पहचाना नहीं गया।`;
    if (shortLang === 'ta') return `குரல் கட்டளை: ${transcriptText}। அங்கீகரிக்கப்படவில்லை.`;
    if (shortLang === 'te') return `ఆదేశం: ${transcriptText}। గుర్తించబడలేదు.`;
    if (shortLang === 'kn') return `ಆಜ್ಞೆ: ${transcriptText}। ಗುರುತಿಸಲಾಗಿಲ್ಲ.`;
  }

  return translated;
}

let isSpeakingInternal = false;

export function configureSpeech(speed: number, lang: string, pitch = 1.0, volume = 1.0) {
  currentSettings = { speed, lang, pitch, volume };
}

export function speak(text: string, onEnd?: () => void) {
  // Cancel any active online audio playback
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch (e) {
      console.warn('Error pausing active audio:', e);
    }
    activeAudio = null;
  }

  isSpeakingInternal = true;

  const handleEnd = () => {
    isSpeakingInternal = false;
    if (onEnd) onEnd();
  };

  if (!('speechSynthesis' in window)) {
    handleEnd();
    return;
  }
  
  // Standard cancel for native speech synthesis
  window.speechSynthesis.cancel();

  const lang = currentSettings.lang;
  const isEnglish = lang.toLowerCase().startsWith('en');

  // Translate text to regional language if necessary
  const translatedText = translateText(text, lang);
  console.log(`TTS Original: "${text}" | Translated to ${lang}: "${translatedText}"`);

  // Query native system voices for English
  const voices = window.speechSynthesis.getVoices();

  // For regional languages (Tamil, Hindi, etc), native browser voices are often broken or 
  // read with an English accent. Always use the high-quality Google TTS / Backend TTS.
  if (!isEnglish) {
    if (!navigator.onLine) {
      // OFFLINE MODE: Use backend TTS
      console.log(`Offline Mode: Using local backend TTS for ${lang}.`);
      fetch('http://localhost:8000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: translatedText })
      })
      .then(res => res.json())
      .then(data => {
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
          audio.playbackRate = currentSettings.speed;
          activeAudio = audio;
          audio.onended = () => { if (activeAudio === audio) activeAudio = null; handleEnd(); };
          audio.onerror = () => { if (activeAudio === audio) activeAudio = null; handleEnd(); };
          audio.play();
        } else {
          handleEnd();
        }
      })
      .catch(err => {
        console.error('Local TTS failed:', err);
        handleEnd();
      });
      return;
    }

    console.log(`No native voice found for language ${lang}. Using online TTS fallback.`);
    const shortLang = lang.split('-')[0]; // 'hi', 'ta', 'te'
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${shortLang}&client=tw-ob&q=${encodeURIComponent(translatedText)}`;

    try {
      const audio = new Audio(url);
      audio.playbackRate = currentSettings.speed;
      activeAudio = audio;
      
      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
        handleEnd();
      };
      audio.onerror = () => {
        if (activeAudio === audio) activeAudio = null;
        handleEnd();
      };

      audio.play().catch(err => {
        console.warn('Online TTS play failed. Trying browser synthesis fallback:', err);
        const utterance = new SpeechSynthesisUtterance(translatedText);
        utterance.rate = currentSettings.speed;
        utterance.pitch = currentSettings.pitch;
        utterance.volume = currentSettings.volume;
        utterance.lang = currentSettings.lang;
        
        if (voices.length > 0) {
          const matchedVoice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) ||
                               voices.find(v => v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }
        }

        utterance.onend = handleEnd;
        utterance.onerror = handleEnd;
        window.speechSynthesis.speak(utterance);
      });
      return;
    } catch (e) {
      console.error('Audio initialization failed. Falling back to native SpeechSynthesis:', e);
    }
  }

  // Native web speech synthesis fallback / standard flow
  const utterance = new SpeechSynthesisUtterance(translatedText);
  utterance.rate = currentSettings.speed;
  utterance.pitch = currentSettings.pitch;
  utterance.volume = currentSettings.volume;
  utterance.lang = currentSettings.lang;

  if (voices.length > 0) {
    const matchedVoice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) ||
                         voices.find(v => v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  utterance.onend = handleEnd;
  utterance.onerror = handleEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  isSpeakingInternal = false;
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch (e) {
      console.warn('Error pausing active audio during stop:', e);
    }
    activeAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking() {
  return isSpeakingInternal;
}

export type SpeechRecognitionCallback = (transcript: string) => void;

export class SpeechRecognitionHelper {
  private recognition: any = null;
  private callback: SpeechRecognitionCallback | null = null;
  private onEndCallback: (() => void) | null = null;
  private active = false;
  private running = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private finalTranscript = '';
  private readonly silenceMs: number;
  private isContinuousMode = false;
  private wakeWord = 'hey vision';
  private requiresWakeWord = true;

  constructor(silenceMs = 1200) {
    this.silenceMs = silenceMs;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      this.recognition = new SR();
      // Continuous so the user can speak a full sentence
      this.recognition.continuous = true;
      // Interim results let us detect pauses in speech
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = currentSettings.lang;
    }
  }

  isSupported() {
    return this.recognition !== null;
  }

  private _clearSilenceTimer() {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private _commitTranscript() {
    this._clearSilenceTimer();
    let text = this.finalTranscript.trim().toLowerCase();
    this.finalTranscript = '';
    
    if (text && this.active && this.callback) {
      if (this.requiresWakeWord) {
        if (text.includes(this.wakeWord)) {
          // Speak "Yes, I'm listening." if they only said the wake word, or just process the rest
          const stripped = text.replace(new RegExp(`.*${this.wakeWord}`, 'i'), '').trim();
          if (stripped.length > 0) {
            this.callback(stripped);
          } else {
            // They just said the wake word.
            this.callback(this.wakeWord);
          }
        }
      } else {
        this.callback(text);
      }
    }
    
    // In continuous background mode, do not stop on commit, just let it keep listening
    if (!this.isContinuousMode) {
      this.stop();
    }
  }

  setContinuousMode(continuous: boolean, requireWakeWord: boolean, wakeWord: string = 'hey vision') {
    this.isContinuousMode = continuous;
    this.requiresWakeWord = requireWakeWord;
    this.wakeWord = wakeWord.toLowerCase();
  }

  start(callback: SpeechRecognitionCallback, onEnd?: () => void) {
    if (!this.recognition) return;

    // If already running, stop safely first
    if (this.running) {
      try { this.recognition.stop(); } catch (_) {}
    }

    this.callback = callback;
    this.onEndCallback = onEnd || null;
    this.active = true;
    this.running = true;
    this.finalTranscript = '';
    this.recognition.lang = currentSettings.lang;

    this.recognition.onresult = (e: any) => {
      if (!this.active) return;

      // Accumulate final results; ignore interim
      let interimTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          this.finalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Every time we get speech (final or interim) reset the silence timer
      this._clearSilenceTimer();
      if (this.active) {
        this.silenceTimer = setTimeout(() => {
          // Use final transcript; if none accumulated yet but interim exists, use that
          if (!this.finalTranscript.trim() && interimTranscript.trim()) {
            this.finalTranscript = interimTranscript;
          }
          this._commitTranscript();
        }, this.silenceMs);
      }
    };

    this.recognition.onerror = (e: any) => {
      console.warn('Speech recognition error:', e.error);
      this._clearSilenceTimer();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.active = false;
        this.running = false;
      }
      // On network or audio-capture errors, let onend restart the loop
    };

    this.recognition.onend = () => {
      this.running = false;
      // If we have pending transcript, commit it
      if (this.finalTranscript.trim() && this.active) {
        this._clearSilenceTimer();
        this._commitTranscript();
      }
      
      if (this.active && this.isContinuousMode) {
        // Automatically restart if it was stopped by the browser and we are in continuous mode
        try {
          this.recognition.start();
        } catch (e) {
          console.warn('Speech recognition restart error:', e);
        }
      } else if (this.active && this.onEndCallback) {
        this.onEndCallback();
      }
    };

    if (!navigator.onLine) {
      // OFFLINE MODE: Fallback to simulated offline mic capture or backend STT if available
      console.log('Offline Mode: Browser SpeechRecognition disabled. Backend STT simulated.');
      // Simulate capture then end
      setTimeout(() => {
        if (this.active && this.callback) {
          this.callback("Offline speech mode activated");
        }
        if (this.onEndCallback) this.onEndCallback();
        this.running = false;
      }, 3000);
      return;
    }

    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Speech recognition start error:', e);
      this.running = false;
    }
  }

  stop() {
    this.active = false;
    this._clearSilenceTimer();
    if (this.recognition && this.running) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Speech recognition stop error:', e);
      }
    }
    this.running = false;
  }
}
