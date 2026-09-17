# VisionAssist AI Glasses - Multimodal Scene Understanding, Wolfram|Alpha & Google Maps Navigation

VisionAssist transforms smart glasses into an intelligent, hands-free multimodal assistant for visually impaired users. It combines **Google Gemini 2.5 Flash** for holistic scene understanding and visual question answering, **Wolfram|Alpha** for scientific and mathematical calculations, and **Voice-Controlled Google Maps Navigation** for authoritative routing with dynamic travel mode support (`walking`, `driving`, `cycling`, `transit`).

---

## 1. System Architecture

```text
                  🎤 AI GLASSES
                  Camera + Mic
                       │
                       ▼
              Speech-to-Text
                       │
                       ▼
              ┌────────────────┐
              │  AI INTENT     │
              │    ROUTER      │
              └───────┬────────┘
                      │
       ┌──────────────┼─────────────────┐
       ▼              ▼                 ▼
   Navigation      Vision/OCR        Wolfram
       │              │                 │
       ▼              ▼                 ▼
  Google Maps   Gemini 2.5 Vision  Calculation
       │              │                 │
       └──────────────┼─────────────────┘
                      ▼
                 Response/TTS
                      │
                      ▼
                 🔊 AI GLASSES
```

---

## 2. Core Capabilities

### 🧭 1. Voice-Controlled Google Maps Navigation
- **Natural Language Destination Extraction**: *"Take me to Chennai Central"*, *"Navigate to Marina Beach"*, *"How do I get to the airport?"*, *"Guide me to the nearest hospital"*, *"Take me home"*.
- **Authoritative Routing**: Hands-free launch to Google Maps app/deep-link (`https://www.google.com/maps/dir/?api=1&destination=...&travelmode=...`) with GPS location.
- **Dynamic Travel Modes**: Supports `walking`, `driving`, `cycling`, and `transit` (default configurable via `DEFAULT_TRAVEL_MODE`).
- **Conversational Queries**: *"How far is my destination?"*, *"How long will it take?"*, *"Where am I?"*, *"Cancel navigation"*, *"Stop navigation"*.
- **Safety First**: Turn-by-turn routing is delegated strictly to Google Maps (the LLM never invents directions).

### 🌟 2. Multimodal Scene Understanding (Gemini 2.5 Flash)
- Holistic scene explanation with spatial positions relative to the user (doors, stairs, chairs, tables, vehicles, obstacles).
- Hazards and immediate walking obstacles are prioritized first.
- Voice triggers: *"Describe my surroundings"*, *"What is around me?"*, *"Look around"*.

### 🔍 3. Visual Question Answering (VQA)
- Ask specific questions about visible objects, people, or pathways without hallucination.
- Qualifies uncertainty (*"I am not sure"*, *"I can see what appears to be..."*).
- Voice triggers: *"What is in front of me?"*, *"Is there a chair on my left?"*, *"What is on the table?"*, *"Where is the door?"*, *"How many people are there?"*.

### 📖 4. OCR Text & Signage Reader
- Extracts and reads visible text from signs, notices, menus, doors, product labels, and documents.
- Voice triggers: *"Read this"*, *"Read this sign"*, *"What does this sign say?"*, *"Read label"*.

### 🔬 5. Wolfram|Alpha Computational Engine
- High-precision mathematical and scientific reasoning, calculus, algebra, unit conversions, and physics calculations.
- Voice triggers: *"What is 125 multiplied by 48?"*, *"Solve this equation"*, *"What is the integral of x squared from 0 to 5?"*, *"Convert 5 kilometers to miles"*.

---

## 3. Environment Configuration

Create a `.env` file in `project/` based on `.env.example`:

```env
# 1. AI Model & Multimodal Provider
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
OPENROUTER_API_KEY=your_openrouter_api_key_here

# 2. Wolfram|Alpha Computational Engine
WOLFRAM_APP_ID=your_wolfram_app_id_here

# 3. Google Maps Voice Navigation
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
DEFAULT_TRAVEL_MODE=walking
ENABLE_NAVIGATION=true

# 4. Supabase Cloud (Optional for Guardian Telemetry)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Obtaining API Keys:
1. **Google Gemini API Key:** [Google AI Studio](https://aistudio.google.com/)
2. **Google Maps Platform:** [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/)
3. **Wolfram|Alpha App ID:** [Wolfram|Alpha Developer Portal](https://developer.wolframalpha.com/)
4. **OpenRouter API Key (Optional):** [OpenRouter Keys](https://openrouter.ai/keys)

---

## 4. Local Installation & Development

### Backend (Python FastAPI)
```bash
cd project/backend
pip install -r ../requirements.txt
python main.py
```
*Backend runs on `http://127.0.0.1:8000`*

### Frontend (Vite + React)
```bash
cd project
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## 5. Testing Workflows

| Test | Voice Command | Expected Action & Response |
| :--- | :--- | :--- |
| **Test 1** | *"Describe my surroundings"* | Captures frame $\to$ Gemini 2.5 Flash $\to$ Explains objects, doors, and clear path ahead |
| **Test 2** | *"What is in front of me?"* | Multimodal VQA $\to$ Identifies immediate object/obstacle with distance estimate |
| **Test 3** | *"Read this sign"* | OCR/Vision LLM $\to$ Extracts visible text: *"The sign says: Emergency Exit"* |
| **Test 4** | *"Solve this equation"* | Wolfram|Alpha $\to$ Computes algebraic/calculus solution and speaks result |
| **Test 5** | *"What is 125 multiplied by 48?"* | Wolfram|Alpha $\to$ *"The result is 6,000."* |
| **Test 6** | *"Is there a chair on my left?"* | Multimodal VQA $\to$ Evaluates left quadrant of frame and answers accurately |

---

## 6. Hardware Integration (AI Smart Glasses)
1. **Camera Feed:** Standard UVC USB camera or wireless RTSP/WebRTC video stream connected as environment camera.
2. **Microphone:** Noise-cancelling Bluetooth/directional microphone with Web Speech API continuous listener.
3. **Audio Output:** Bone-conduction earphones for safe ambient awareness while hearing turn-by-turn guidance.
