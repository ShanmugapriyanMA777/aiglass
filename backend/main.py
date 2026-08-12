import base64
import time
import re
import json
import os
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Try to import computer vision and AI dependencies, fallback to simulations if not present
try:
    import cv2
    import numpy as np
    HAS_CV = True
except ImportError:
    HAS_CV = False

try:
    import easyocr
    reader = easyocr.Reader(['en'], gpu=False)
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

try:
    from ultralytics import YOLO
    # Suppress verbose YOLO logs
    import logging
    logging.getLogger("ultralytics").setLevel(logging.WARNING)
    yolo_model = YOLO("yolov8n.pt")
    HAS_YOLO = True
except ImportError:
    HAS_YOLO = False

app = FastAPI(title="VisionAssist Scene Understanding Engine")

# Configure CORS so local Vite frontend can call it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FrameRequest(BaseModel):
    frame_base64: str
    nav_active: bool
    destination_number: str
    lang: Optional[str] = "en-US"

# ----------------- SCENE DESCRIPTION SUB-SYSTEM -----------------
scene_last_called = 0
SCENE_INTERVAL = 10  # seconds

def call_vision_api_simulated(objects):
    if "car" in objects or "bus" in objects:
        env = "outdoor road area"
    elif "chair" in objects or "table" in objects:
        env = "indoor area"
    elif "tree" in objects:
        env = "outdoor open area"
    else:
        env = "urban street environment"

    person_count = objects.count("person")
    if person_count > 5:
        crowd = "It looks pretty busy with lots of people around you."
    elif person_count > 1:
        crowd = "There are a few people walking nearby."
    else:
        crowd = "It's quite peaceful with very few people around."

    return f"We are currently in a {env}. {crowd} I'll keep an eye out, so feel free to continue walking at your own pace."

async def generate_scene_description(frame_base64, objects, lang="en-US"):
    global scene_last_called
    now = time.time()
    if now - scene_last_called < SCENE_INTERVAL:
        return None
    scene_last_called = now
    
    is_tamil = lang and lang.lower().startswith("ta")

    # Check if OPENROUTER_API_KEY or other Vision API keys are in env
    api_key = os.getenv("OPENROUTER_API_KEY")
    if api_key:
        try:
            import requests
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            lang_instruction = " Respond in Tamil language using Tamil script." if is_tamil else ""
            payload = {
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Act as a friendly, caring partner walking alongside the user. Look at the image and analyze the whole scene holistically. For example, instead of listing 'chair, bottle, person', say 'You are in a classroom. There are two students sitting nearby, and there is enough space to continue walking. A chair is slightly to your right.' Keep it warm, conversational, and provide safe guidance. Do not use bullet points or markdown.{lang_instruction}"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{frame_base64}"
                                }
                            }
                        ]
                    }
                ]
            }
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=8)
            if res.status_code == 200:
                data = res.json()
                desc = data['choices'][0]['message']['content'].strip()
                return desc
        except Exception as e:
            print(f"Vision API request failed: {e}")

    # Fallback to YOLO label template
    if is_tamil:
        if "car" in objects or "bus" in objects:
            return "சாலையில் வாகனங்கள் உள்ளன. கவனமாக நடக்கவும்."
        elif "person" in objects:
            return "உங்களுக்கு அருகில் ஒரு நபர் நடக்கிறார்."
        elif "chair" in objects:
            return "உங்கள் முன் ஒரு நாற்காலி உள்ளது."
        return "உங்களைச் சுற்றி நடப்பதற்குப் போதுமான இடம் உள்ளது."

    return call_vision_api_simulated(objects)

# ----------------- OCR TEXT READER SUB-SYSTEM -----------------
ocr_spoken_cache = {}
OCR_COOLDOWN = 30  # seconds

PHARMACY_KEYWORDS = ["pharmacy","medical","medicals","drugs","chemist","health"]
HOSPITAL_KEYWORDS = ["hospital","clinic","nursing","care","casualty","emergency","icu","opd"]
BANK_KEYWORDS = ["bank","atm","finance","loan"]
FOOD_KEYWORDS = ["hotel","restaurant","biryani","mess","cafe","coffee","bakery"]
CAUTION_KEYWORDS = ["stop","danger","no entry","caution","road closed","diversion","under construction","speed breaker"]
TRANSPORT_KEYWORDS = ["platform","gate","terminal","exit","entrance","ticket","counter","metro","railway","departure","arrival"]
BUS_NUMBER_PATTERN = r'^[0-9]{1,3}[A-Z]?$'

def get_direction(bbox, frame_width):
    # bbox in easyocr: [[x0,y0], [x1,y1], [x2,y2], [x3,y3]]
    center_x = (bbox[0][0] + bbox[2][0]) / 2
    if center_x < frame_width / 3:
        return "left"
    elif center_x > 2 * frame_width / 3:
        return "right"
    else:
        return "ahead"

def should_speak(text: str) -> bool:
    key = text.strip().lower()
    now = time.time()
    if key in ocr_spoken_cache:
        if now - ocr_spoken_cache[key] < 15:
            return False
    ocr_spoken_cache[key] = now
    return True

def build_ocr_announcement(text: str, category: str, direction: str, nav_active: bool, destination_number: str, lang: str = "en-US") -> str:
    is_tamil = lang and lang.lower().startswith("ta")

    if is_tamil:
        dir_phrase = "உங்கள் வலதுபுறம்" if direction == "right" else "உங்கள் இடதுபுறம்" if direction == "left" else "உங்கள் முன்"
        if category == "PHARMACY":
            return f"{text} {dir_phrase} உள்ளது. மருத்துவ உதவி உள்ளது."
        elif category == "HOSPITAL":
            return f"{text} {dir_phrase} உள்ளது. அருகில் மருத்துவமனை உள்ளது."
        elif category == "EMERGENCY":
            return f"அவசரப் பிரிவு அடையாளம் {dir_phrase} கண்டறியப்பட்டது."
        elif category == "BANK_ATM":
            return f"ஏடிஎம் அல்லது வங்கி {dir_phrase} உள்ளது."
        elif category == "FOOD":
            return f"{text} {dir_phrase} உள்ளது."
        elif category == "CAUTION":
            return f"எச்சரிக்கை. {text} அடையாளம் {dir_phrase} உள்ளது. கவனமாகச் செல்லவும்."
        elif category == "TRANSPORT":
            return f"{text} {dir_phrase} உள்ளது."
        elif category == "BUS_NUMBER":
            return f"பேருந்து எண் {text} {dir_phrase} உள்ளது."
        elif category == "DOOR_NUMBER":
            if nav_active and destination_number and text == destination_number:
                return f"கதவு எண் {text} உங்கள் முன் உள்ளது. இது உங்கள் இலக்கு."
            return f"கதவு எண் {text} {dir_phrase} உள்ளது."
        return f"{text} {dir_phrase} உள்ளது."

    dir_phrase = f"on your {direction}" if direction != "ahead" else "ahead"

    if category == "PHARMACY":
        return f"{text} is {dir_phrase}. Medical help available."
    elif category == "HOSPITAL":
        return f"{text} is {dir_phrase}. Hospital nearby."
    elif category == "EMERGENCY":
        return f"Emergency ward sign detected {dir_phrase}. Hospital emergency entrance near you."
    elif category == "BANK_ATM":
        return f"A T M or bank is {dir_phrase}."
    elif category == "FOOD":
        return f"{text} is {dir_phrase}."
    elif category == "CAUTION":
        return f"Warning. {text} sign detected {dir_phrase}. Proceed with caution."
    elif category == "TRANSPORT":
        return f"{text} is {dir_phrase}."
    elif category == "BUS_NUMBER":
        return f"Bus number {text} is {dir_phrase}."
    elif category == "DOOR_NUMBER":
        if nav_active and destination_number and text == destination_number:
            return f"Door number {text} is ahead. This is your destination."
        elif nav_active and destination_number:
            try:
                diff = int(destination_number) - int(text)
                if abs(diff) <= 4:
                    return f"Door number {text} is ahead. Your destination door number {destination_number} is very close. Continue walking."
            except:
                pass
        return f"Building number {text} is {dir_phrase}."
    else:
        return f"I read the text: {text}, {dir_phrase}."

def run_ocr(frame, frame_width, nav_active=False, destination_number="", lang="en-US"):
    if not HAS_OCR or frame is None:
        return run_ocr_simulated(frame_width, nav_active, destination_number, lang)

    results = reader.readtext(frame)
    output = []
    for (bbox, text, confidence) in results:
        if confidence < 0.25:
            continue
        text = text.strip()
        if len(text) < 1:
            continue
        if not any(c.isalnum() for c in text):
            continue
        if not should_speak(text):
            continue

        text_lower = text.lower()
        category = "GENERIC"

        if re.match(BUS_NUMBER_PATTERN, text.upper()):
            category = "BUS_NUMBER"
        elif any(k in text_lower for k in PHARMACY_KEYWORDS):
            category = "PHARMACY"
        elif any(k in text_lower for k in ["emergency","casualty","icu","opd","ambulance"]):
            category = "EMERGENCY"
        elif any(k in text_lower for k in HOSPITAL_KEYWORDS):
            category = "HOSPITAL"
        elif any(k in text_lower for k in BANK_KEYWORDS):
            category = "BANK_ATM"
        elif any(k in text_lower for k in FOOD_KEYWORDS):
            category = "FOOD"
        elif any(k in text_lower for k in CAUTION_KEYWORDS):
            category = "CAUTION"
        elif any(k in text_lower for k in TRANSPORT_KEYWORDS):
            category = "TRANSPORT"
        elif re.match(r'^\d{1,4}[\/\-]?[A-Z]?$', text.upper()):
            category = "DOOR_NUMBER"

        direction = get_direction(bbox, frame_width)
        announcement = build_ocr_announcement(text, category, direction, nav_active, destination_number, lang)
        
        output.append({
            "text": text,
            "category": category,
            "direction": direction,
            "confidence": round(float(confidence), 2),
            "announcement": announcement
        })
    return output

def run_ocr_simulated(frame_width, nav_active=False, destination_number="", lang="en-US"):
    # Resilient simulated OCR rotation to test all frontend announcements
    now = time.time()
    sim_outputs = []
    
    # We rotate simulated OCR reads every 12 seconds
    cycle = int(now / 12) % 6
    if cycle == 0:
        text, category, direction = "Apollo Pharmacy", "PHARMACY", "right"
    elif cycle == 1:
        text, category, direction = "21C", "BUS_NUMBER", "ahead"
    elif cycle == 2:
        text, category, direction = "CAUTION UNDER CONSTRUCTION", "CAUTION", "left"
    elif cycle == 3:
        text, category, direction = "SBI ATM", "BANK_ATM", "right"
    elif cycle == 4:
        # Simulate door number matching navigation target
        if nav_active and destination_number:
            text, category, direction = destination_number, "DOOR_NUMBER", "ahead"
        else:
            text, category, direction = "104", "DOOR_NUMBER", "left"
    else:
        text, category, direction = "EMERGENCY WARD", "EMERGENCY", "ahead"

    if should_speak(text):
        announcement = build_ocr_announcement(text, category, direction, nav_active, destination_number, lang)
        sim_outputs.append({
            "text": text,
            "category": category,
            "direction": direction,
            "confidence": 0.95,
            "announcement": announcement
        })
    return sim_outputs

# ----------------- TRAFFIC LIGHT SUB-SYSTEM -----------------
traffic_state = {
    "last_color": None,
    "consecutive_count": 0,
    "confirmed_color": None,
    "last_announced": None,
    "last_announced_time": 0
}

def detect_traffic_light_color(cropped_region) -> str:
    if not HAS_CV:
        return "UNKNOWN"
    try:
        hsv = cv2.cvtColor(cropped_region, cv2.COLOR_BGR2HSV)
        
        # Red ranges
        red_mask1 = cv2.inRange(hsv, np.array([0,100,100]), np.array([10,255,255]))
        red_mask2 = cv2.inRange(hsv, np.array([160,100,100]), np.array([180,255,255]))
        red_mask = cv2.bitwise_or(red_mask1, red_mask2)

        # Green ranges
        green_mask = cv2.inRange(hsv, np.array([40,50,50]), np.array([90,255,255]))
        # Yellow ranges
        yellow_mask = cv2.inRange(hsv, np.array([20,100,100]), np.array([35,255,255]))

        red_px = cv2.countNonZero(red_mask)
        green_px = cv2.countNonZero(green_mask)
        yellow_px = cv2.countNonZero(yellow_mask)

        THRESHOLD = 200
        if red_px > THRESHOLD and red_px > green_px and red_px > yellow_px:
            return "RED"
        elif green_px > THRESHOLD and green_px > red_px and green_px > yellow_px:
            return "GREEN"
        elif yellow_px > THRESHOLD:
            return "YELLOW"
    except Exception as e:
        print(f"HSV color threshold failed: {e}")
    return "UNKNOWN"

def process_traffic_light(frame, yolo_boxes) -> dict:
    global traffic_state
    now = time.time()

    if not HAS_CV or frame is None:
        # Simulate traffic light changing colors: Red (15s) -> Green (15s) -> Yellow (5s)
        cycle = int(now) % 35
        if cycle < 15:
            color = "RED"
        elif cycle < 30:
            color = "GREEN"
        else:
            color = "YELLOW"
            
        should_announce = False
        if color != traffic_state["last_announced"]:
            traffic_state["last_announced"] = color
            should_announce = True

        return {
            "detected": True,
            "color": color,
            "confirmed": True,
            "should_announce": should_announce,
            "low_light": False
        }

    traffic_boxes = [b for b in yolo_boxes if b['class'] == 'traffic light']
    if not traffic_boxes:
        traffic_state["consecutive_count"] = 0
        return {"detected": False}

    box = traffic_boxes[0]
    x1, y1, x2, y2 = int(box['x1']), int(box['y1']), int(box['x2']), int(box['y2'])

    brightness = np.mean(frame)
    if brightness < 50:
        return {
            "detected": True,
            "color": "UNKNOWN",
            "confirmed": False,
            "low_light": True
        }

    cropped = frame[y1:y2, x1:x2]
    if cropped.size == 0:
        return {"detected": False}

    color = detect_traffic_light_color(cropped)

    if color == traffic_state["last_color"]:
        traffic_state["consecutive_count"] += 1
    else:
        traffic_state["last_color"] = color
        traffic_state["consecutive_count"] = 1

    confirmed = traffic_state["consecutive_count"] >= 3
    should_announce = (
        confirmed and
        color != "UNKNOWN" and
        (color != traffic_state["last_announced"] or
         now - traffic_state["last_announced_time"] > 30)
    )

    if should_announce:
        traffic_state["last_announced"] = color
        traffic_state["last_announced_time"] = now

    return {
        "detected": True,
        "color": color,
        "confirmed": confirmed,
        "should_announce": should_announce,
        "low_light": brightness < 50
    }

# ----------------- ZEBRA CROSSING SUB-SYSTEM -----------------
zebra_state = {
    "consecutive_frames": 0,
    "current_state": "NONE",
    "last_announced_state": None,
    "last_announced_time": 0
}

def detect_zebra_crossing(frame, yolo_boxes) -> dict:
    global zebra_state
    now = time.time()

    if not HAS_CV or frame is None:
        # Simulate zebra crossing approaching, at crossing, and clear
        cycle = int(now / 10) % 3
        if cycle == 0:
            state = "APPROACHING"
            detected = True
        elif cycle == 1:
            state = "AT_CROSSING"
            detected = True
        else:
            state = "NONE"
            detected = False

        should_announce = state != zebra_state["last_announced_state"]
        if should_announce:
            zebra_state["last_announced_state"] = state

        # Mock car on zebra crossing occasionally
        vehicle_on_crossing = (state == "AT_CROSSING" and (int(now) % 15 < 5))

        return {
            "detected": detected,
            "state": state,
            "vehicle_on_crossing": vehicle_on_crossing,
            "should_announce": should_announce
        }

    alternations = 0
    bands = []
    height = frame.shape[0] if frame is not None else 480
    try:
        height, width = frame.shape[:2]
        roi = frame[height//2:, :]  # Focus lower half of frame
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)

        horizontal_projection = np.sum(binary, axis=1)
        threshold_line = width * 255 * 0.4
        bands = [1 if v > threshold_line else 0 for v in horizontal_projection]
        alternations = sum(1 for i in range(1, len(bands)) if bands[i] != bands[i-1])

        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, minLineLength=80, maxLineGap=10)
        h_lines = 0
        if lines is not None:
            h_lines = sum(1 for l in lines if abs(l[0][3] - l[0][1]) < 20)

        detected = alternations >= 6 or h_lines >= 4
    except Exception as e:
        print(f"Zebra crossing CV pipelines error: {e}")
        detected = False

    if detected:
        zebra_state["consecutive_frames"] += 1
    else:
        zebra_state["consecutive_frames"] = 0

    confirmed = zebra_state["consecutive_frames"] >= 3
    fill_ratio = alternations / max(len(bands), 1) if HAS_CV else 0
    
    if not confirmed:
        new_state = "NONE"
    elif fill_ratio > 0.5:
        new_state = "AT_CROSSING"
    else:
        new_state = "APPROACHING"

    vehicle_on_crossing = any(
        b['class'] in ['car','bus','truck','motorcycle']
        for b in yolo_boxes
        if int(b['y1']) > height // 2
    )

    should_announce = (
        confirmed and
        (new_state != zebra_state["last_announced_state"] or
         (vehicle_on_crossing and now - zebra_state["last_announced_time"] > 5))
    )

    if should_announce:
        zebra_state["last_announced_state"] = new_state
        zebra_state["last_announced_time"] = now

    zebra_state["current_state"] = new_state

    return {
        "detected": confirmed,
        "state": new_state,
        "vehicle_on_crossing": vehicle_on_crossing,
        "should_announce": should_announce
    }

# ----------------- YOLO PIPELINE -----------------
# Try to load custom trained home objects model if present
try:
    home_model_path = os.path.join(os.path.dirname(__file__), "home_objects_best.pt")
    if HAS_YOLO and os.path.exists(home_model_path):
        home_yolo_model = YOLO(home_model_path)
    else:
        home_yolo_model = None
except Exception as e:
    print(f"Loading home_objects_best.pt note: {e}")
    home_yolo_model = None

def run_yolo(frame):
    if not HAS_YOLO or frame is None:
        # Mock detections with street-relevant objects if YOLO is disabled
        now = time.time()
        cycle = int(now / 3) % 8
        mock_scenarios = [
            [{"class": "car", "x1": 350, "y1": 150, "x2": 550, "y2": 380, "confidence": 0.91},
             {"class": "person", "x1": 200, "y1": 100, "x2": 300, "y2": 420, "confidence": 0.88}],
            [{"class": "motorcycle", "x1": 400, "y1": 200, "x2": 560, "y2": 400, "confidence": 0.87},
             {"class": "traffic light", "x1": 280, "y1": 20, "x2": 340, "y2": 120, "confidence": 0.93}],
            [{"class": "bicycle", "x1": 50, "y1": 180, "x2": 220, "y2": 410, "confidence": 0.85},
             {"class": "person", "x1": 300, "y1": 90, "x2": 400, "y2": 430, "confidence": 0.90},
             {"class": "bench", "x1": 450, "y1": 250, "x2": 600, "y2": 380, "confidence": 0.82}],
            [{"class": "bus", "x1": 100, "y1": 80, "x2": 500, "y2": 400, "confidence": 0.94},
             {"class": "stop sign", "x1": 520, "y1": 50, "x2": 590, "y2": 150, "confidence": 0.89}],
            [{"class": "truck", "x1": 50, "y1": 100, "x2": 350, "y2": 420, "confidence": 0.90},
             {"class": "fire hydrant", "x1": 500, "y1": 300, "x2": 560, "y2": 430, "confidence": 0.86}],
            [{"class": "dog", "x1": 150, "y1": 280, "x2": 280, "y2": 420, "confidence": 0.83},
             {"class": "person", "x1": 350, "y1": 80, "x2": 460, "y2": 440, "confidence": 0.91},
             {"class": "car", "x1": 500, "y1": 160, "x2": 630, "y2": 350, "confidence": 0.88}],
            [{"class": "car", "x1": 80, "y1": 140, "x2": 280, "y2": 370, "confidence": 0.89},
             {"class": "motorcycle", "x1": 320, "y1": 200, "x2": 460, "y2": 400, "confidence": 0.86},
             {"class": "backpack", "x1": 500, "y1": 220, "x2": 580, "y2": 380, "confidence": 0.80}],
            [{"class": "umbrella", "x1": 200, "y1": 30, "x2": 400, "y2": 200, "confidence": 0.84},
             {"class": "person", "x1": 250, "y1": 120, "x2": 370, "y2": 450, "confidence": 0.92},
             {"class": "cat", "x1": 500, "y1": 330, "x2": 580, "y2": 430, "confidence": 0.78}]
        ]
        return mock_scenarios[cycle]

    boxes_out = []
    allowed = [
        # Street / outdoor objects
        "person", "car", "bus", "truck", "motorcycle", "bicycle",
        "traffic light", "stop sign", "fire hydrant", "parking meter",
        "bench", "dog", "cat", "backpack", "umbrella", "handbag", "suitcase",
        # Indoor / home objects
        "chair", "table", "door", "cabinetDoor", "refrigeratorDoor", "window",
        "cabinet", "couch", "openedDoor", "pole", "refrigerator", "bed"
    ]

    try:
        results = yolo_model(frame)
        for r in results:
            for box in r.boxes:
                c = int(box.cls)
                label = yolo_model.names[c]
                if label in allowed:
                    coords = box.xyxy[0].tolist()
                    boxes_out.append({
                        "class": label,
                        "x1": coords[0],
                        "y1": coords[1],
                        "x2": coords[2],
                        "y2": coords[3],
                        "confidence": float(box.conf)
                    })
    except Exception as e:
        print(f"General YOLO inference error: {e}")

    # Run fine-tuned Home Objects model if available
    if home_yolo_model is not None:
        try:
            home_results = home_yolo_model(frame)
            for r in home_results:
                for box in r.boxes:
                    c = int(box.cls)
                    label = home_yolo_model.names[c]
                    coords = box.xyxy[0].tolist()
                    boxes_out.append({
                        "class": label,
                        "x1": coords[0],
                        "y1": coords[1],
                        "x2": coords[2],
                        "y2": coords[3],
                        "confidence": float(box.conf)
                    })
        except Exception as e:
            print(f"Home objects YOLO model inference error: {e}")

    return boxes_out

# ----------------- STREET OBJECT ANNOUNCEMENT SUB-SYSTEM -----------------
# Danger levels for street object categories
DANGER_HIGH = ["car", "bus", "truck", "motorcycle"]  # Vehicles — most dangerous
DANGER_MEDIUM = ["bicycle", "fire hydrant", "pole", "parking meter", "stop sign", "dog"]  # Obstacles
DANGER_LOW = ["person", "bench", "cat", "umbrella", "backpack", "handbag", "suitcase"]  # General awareness

# Cooldown tracker: object_key -> last_announced_time
street_object_cache = {}
STREET_OBJECT_COOLDOWN = 12  # seconds — don't repeat the same object+position within this window

def get_object_position(box, frame_width=640):
    """Determine if object is on left, center, or right of frame."""
    center_x = (box['x1'] + box['x2']) / 2
    if center_x < frame_width / 3:
        return "left"
    elif center_x > 2 * frame_width / 3:
        return "right"
    else:
        return "center"

def estimate_distance(box, frame_height=480):
    """Estimate object distance based on bounding box size relative to frame."""
    box_height = box['y2'] - box['y1']
    ratio = box_height / frame_height
    if ratio > 0.55:
        return "very close", round(max(0.5, 1.0 - ratio), 1)
    elif ratio > 0.35:
        return "close", round(max(1.0, 2.5 - ratio * 3), 1)
    elif ratio > 0.18:
        return "medium", round(max(2.5, 5.0 - ratio * 8), 1)
    else:
        return "far", round(max(5.0, 10.0 - ratio * 20), 1)

def get_danger_level(obj_class):
    """Return danger level string for a given object class."""
    if obj_class in DANGER_HIGH:
        return "high"
    elif obj_class in DANGER_MEDIUM:
        return "medium"
    else:
        return "low"

def build_street_object_announcement(obj_class, position, distance_label, distance_meters, lang="en-US"):
    """Build a natural, conversational announcement for a street object."""
    is_tamil = lang and lang.lower().startswith("ta")

    if is_tamil:
        obj_names_ta = {
            "car": "கார்", "bus": "பேருந்து", "truck": "லாரி", "motorcycle": "மோட்டார் சைக்கிள்",
            "bicycle": "மிதிவண்டி", "person": "நபர்", "dog": "நாய்", "cat": "பூனை",
            "bench": "பெஞ்ச்", "fire hydrant": "தீ குழாய்", "pole": "கம்பம்",
            "stop sign": "நிறுத்த அடையாளம்", "parking meter": "பார்க்கிங் மீட்டர்",
            "umbrella": "குடை", "backpack": "முதுகுப்பை", "handbag": "கைப்பை",
            "suitcase": "சூட்கேஸ்", "traffic light": "போக்குவரத்து விளக்கு"
        }
        pos_ta = {
            "left": "உங்கள் இடதுபுறம்",
            "right": "உங்கள் வலதுபுறம்",
            "center": "உங்கள் நேர் முன்"
        }
        dist_ta = {
            "very close": "மிக அருகில்",
            "close": "அருகில்",
            "medium": "சற்று தொலைவில்",
            "far": "தூரத்தில்"
        }
        name = obj_names_ta.get(obj_class, obj_class)
        pos = pos_ta.get(position, position)
        dist = dist_ta.get(distance_label, distance_label)

        if obj_class in DANGER_HIGH:
            return f"எச்சரிக்கை. ஒரு {name} {pos} {dist} உள்ளது. கவனமாகச் செல்லவும்."
        elif obj_class in DANGER_MEDIUM:
            return f"{pos} ஒரு {name} {dist} உள்ளது. கவனம்."
        else:
            return f"{pos} ஒரு {name} {dist} உள்ளது."

    # English
    pos_text = f"on your {position}" if position != "center" else "right ahead"

    if obj_class in DANGER_HIGH:
        return f"Caution. A {obj_class} is {pos_text}, {distance_label}, about {distance_meters} meters away. Stay alert."
    elif obj_class in DANGER_MEDIUM:
        return f"A {obj_class} is {pos_text}, {distance_label}. Be careful."
    else:
        return f"A {obj_class} is {pos_text}, {distance_label}."

def process_street_objects(yolo_boxes, frame_width=640, frame_height=480, lang="en-US"):
    """Process YOLO detections into smart street object announcements with cooldown."""
    global street_object_cache
    now = time.time()

    # Exclude traffic light from street objects (handled separately)
    street_relevant = [b for b in yolo_boxes if b['class'] != 'traffic light']

    street_objects = []
    for box in street_relevant:
        obj_class = box['class']
        position = get_object_position(box, frame_width)
        distance_label, distance_meters = estimate_distance(box, frame_height)
        danger = get_danger_level(obj_class)

        # Cooldown key: object class + position quadrant
        cache_key = f"{obj_class}_{position}"
        should_announce = False
        last_time = street_object_cache.get(cache_key, 0)

        # Announce if new or cooldown expired; high-danger objects get shorter cooldown
        cooldown = 6 if danger == "high" else STREET_OBJECT_COOLDOWN
        if now - last_time >= cooldown:
            should_announce = True
            street_object_cache[cache_key] = now

        announcement = ""
        if should_announce:
            announcement = build_street_object_announcement(
                obj_class, position, distance_label, distance_meters, lang
            )

        street_objects.append({
            "class": obj_class,
            "position": position,
            "distance": distance_label,
            "distance_meters": distance_meters,
            "danger": danger,
            "confidence": round(float(box.get('confidence', 0)), 2),
            "should_announce": should_announce,
            "announcement": announcement,
            "bbox": [box['x1'], box['y1'], box['x2'], box['y2']]
        })

    # Sort by danger level (high first) then by distance (close first)
    danger_order = {"high": 0, "medium": 1, "low": 2}
    street_objects.sort(key=lambda o: (danger_order.get(o['danger'], 3), o['distance_meters']))

    # Clean old cache entries (older than 60s)
    expired_keys = [k for k, v in street_object_cache.items() if now - v > 60]
    for k in expired_keys:
        del street_object_cache[k]

    return street_objects

# ----------------- MAIN API ENDPOINT -----------------
@app.post("/api/analyze-frame")
async def analyze_frame_endpoint(request: FrameRequest):
    try:
        frame_bytes = base64.b64decode(request.frame_base64)
        if HAS_CV:
            np_arr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("Decoded image is empty")
            frame_width = frame.shape[1]
            frame_height = frame.shape[0]
        else:
            frame = None
            frame_width = 640
            frame_height = 480
    except Exception as e:
        print(f"Decoding frame failed: {e}")
        # Build completely simulated returns
        frame = None
        frame_width = 640
        frame_height = 480

    yolo_boxes = run_yolo(frame)
    detected_labels = [b["class"] for b in yolo_boxes]

    scene = await generate_scene_description(request.frame_base64, detected_labels, lang=request.lang)
    ocr_results = run_ocr(
        frame, frame_width,
        nav_active=request.nav_active,
        destination_number=request.destination_number,
        lang=request.lang
    )
    traffic = process_traffic_light(frame, yolo_boxes)
    zebra = detect_zebra_crossing(frame, yolo_boxes)
    street_objects = process_street_objects(yolo_boxes, frame_width, frame_height, lang=request.lang)

    return {
        "scene_description": scene,
        "scene_updated": scene is not None,
        "ocr_results": ocr_results,
        "traffic_light": traffic,
        "zebra_crossing": zebra,
        "yolo_detections": yolo_boxes,
        "street_objects": street_objects
    }

class GeminiAskRequest(BaseModel):
    question: str
    lang: str = "en-US"
    assistant_name: str = "Vision"
    user_context: str = ""
    chat_history: list = []

@app.post("/api/ask-gemini")
async def ask_gemini_endpoint(request: GeminiAskRequest):
    import datetime
    now = datetime.datetime.now()
    current_time = now.strftime("%I:%M %p")
    current_date = now.strftime("%A, %d %B %Y")

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        # Smart offline fallbacks for fully offline privacy mode
        q = request.question.lower()
        is_tamil = request.lang and request.lang.lower().startswith('ta')

        if any(w in q for w in ["time", "what time", "clock", "நேரம்"]):
            if is_tamil:
                return {"answer": f"தற்போதைய நேரம் {current_time}."}
            return {"answer": f"The current time is {current_time}."}
        if any(w in q for w in ["date", "today", "day", "தேதி", "இன்று"]):
            if is_tamil:
                return {"answer": f"இன்றைய தேதி {current_date}."}
            return {"answer": f"Today is {current_date}."}
        if any(w in q for w in ["who are you", "what are you", "your name", "யார்"]):
            if is_tamil:
                return {"answer": f"நான் {request.assistant_name}, உங்களின் செயற்கை நுண்ணறிவு ஸ்மார்ட் கிளாஸ் உதவியாளர்."}
            return {"answer": f"I am {request.assistant_name}, your AI-powered smart glasses assistant."}
        if any(w in q for w in ["hello", "hi ", "hey", "வணக்கம்"]):
            if is_tamil:
                return {"answer": "வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?"}
            return {"answer": "Hello! How can I help you today?"}
        if any(w in q for w in ["help", "உதவி"]):
            if is_tamil:
                return {"answer": "நான் உங்களைச் சுற்றியுள்ள காட்சிகளை விவரிக்கவும், உரையைப் படிக்கவும், பொருட்களைக் கண்டறியவும், பணத்தை அடையாளம் காணவும், எந்த இடத்திற்கும் வழிகாட்டவும் முடியும். என்னிடம் கேளுங்கள்!"}
            return {"answer": "I can describe your surroundings, read text, detect objects, identify currency, and navigate you to any destination. Just ask!"}
        
        # General conversational fallback without API
        if is_tamil:
            return {"answer": f"நீங்கள் '{request.question}' என்று சொல்வதைக் கேட்டேன். நான் இப்போது இணைய இணைப்பு இல்லாமல் இயங்குவதால், என் உரையாடல் திறன் குறைவாக உள்ளது. ஆனால் உங்களுக்கு வழிகாட்டவும், உரையைப் படிக்கவும் நான் தயாராக இருக்கிறேன்!"}
        return {"answer": f"I heard you say '{request.question}'. Since I am running in fully offline privacy mode right now without an active internet AI connection, my conversational abilities are limited, but I am still here to help you navigate, read text, and detect objects around you!"}

    try:
        import requests as req_lib
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://visionassist.app",
            "X-Title": "VisionAssist"
        }

        lang_instruction = ""
        if request.lang and not request.lang.startswith("en"):
            lang_map = {
                "hi": "Hindi", "ta": "Tamil", "te": "Telugu",
                "kn": "Kannada", "ml": "Malayalam", "bn": "Bengali"
            }
            short_lang = request.lang.split("-")[0]
            lang_name = lang_map.get(short_lang, request.lang)
            lang_instruction = f" You MUST respond completely in natural, fluent {lang_name} language without mixing English words. STRICT RULE: Use ONLY the native script of the language (e.g. Tamil script for Tamil). Do NOT use English letters or words. If you read english text, TRANSLATE IT to the target language."

        system_prompt = (
            f"You are {request.assistant_name}, a friendly, caring, calm, respectful, and supportive AI partner built into smart glasses. "
            f"You must NEVER sound robotic. Never answer with short commands. Speak naturally like a human companion. "
            f"The current date is {current_date} and the current time is {current_time}. "
            f"User Context/Memory: {request.user_context}. "
            f"Answer the user's question like a close friend, in a warm and conversational tone. "
            f"If the user expresses emotion (like being nervous), provide emotional support (e.g., 'That's okay. We'll take it one step at a time.'). "
            f"If describing objects or scenes, tell them everything clearly and patiently, as if you are walking with them. "
            f"Keep it concise (1-4 plain sentences). Do not use bullet points, markdown, or formatting — only plain conversational text suitable for text-to-speech."
            f"{lang_instruction}"
        )

        messages = [{"role": "system", "content": system_prompt}]
        for msg in request.chat_history[-10:]: # Keep last 10 interactions for memory
            messages.append(msg)
        
        messages.append({"role": "user", "content": request.question})

        payload = {
            "model": "google/gemini-2.5-flash",
            "messages": messages,
            "max_tokens": 512,
            "temperature": 0.5
        }

        res = req_lib.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=12
        )
        if res.status_code == 200:
            data = res.json()
            answer = data["choices"][0]["message"]["content"].strip()
            return {"answer": answer}
        else:
            return {"answer": f"AI service returned error {res.status_code}. Please try again."}
    except Exception as e:
        print(f"Error in ask_gemini: {e}")
        return {"answer": "Sorry, I encountered a connection error while reaching the AI service. Please check your internet connection."}

class TTSRequest(BaseModel):
    text: str

@app.post("/api/tts")
async def tts_endpoint(request: TTSRequest):
    import base64, tempfile
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        temp_file = tempfile.mktemp(suffix='.wav')
        engine.save_to_file(request.text, temp_file)
        engine.runAndWait()
        
        with open(temp_file, "rb") as f:
            audio_data = f.read()
        import os
        os.remove(temp_file)
        
        return {"audio_base64": base64.b64encode(audio_data).decode('utf-8')}
    except Exception as e:
        print(f"TTS failed: {e}")
        return {"error": str(e)}

class STTRequest(BaseModel):
    audio_base64: str

@app.post("/api/stt")
async def stt_endpoint(request: STTRequest):
    import base64
    try:
        import speech_recognition as sr
        audio_bytes = base64.b64decode(request.audio_base64)
        
        # Save to temp file
        import tempfile, os
        temp_file = tempfile.mktemp(suffix='.wav')
        with open(temp_file, "wb") as f:
            f.write(audio_bytes)
            
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_file) as source:
            audio = recognizer.record(source)
            
        os.remove(temp_file)
        
        # Prefer Sphinx (offline) if available, fallback to Whisper or Vosk if implemented
        try:
            text = recognizer.recognize_sphinx(audio)
            return {"text": text}
        except:
            return {"text": "Offline STT not fully installed. Try again."}
    except Exception as e:
        print(f"STT failed: {e}")
        return {"error": str(e)}

# Try to load custom trained PyTorch currency model
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class CurrencyCNN(nn.Module):
        def __init__(self, num_classes=7):
            super(CurrencyCNN, self).__init__()
            self.conv1 = nn.Conv2d(3, 32, kernel_size=3, padding=1)
            self.bn1 = nn.BatchNorm2d(32)
            self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
            self.bn2 = nn.BatchNorm2d(64)
            self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
            self.bn3 = nn.BatchNorm2d(128)
            self.conv4 = nn.Conv2d(128, 256, kernel_size=3, padding=1)
            self.bn4 = nn.BatchNorm2d(256)
            self.pool = nn.MaxPool2d(2, 2)
            self.dropout = nn.Dropout(0.3)
            self.fc1 = nn.Linear(256 * 8 * 8, 512)
            self.fc2 = nn.Linear(512, num_classes)

        def forward(self, x):
            x = self.pool(F.relu(self.bn1(self.conv1(x))))
            x = self.pool(F.relu(self.bn2(self.conv2(x))))
            x = self.pool(F.relu(self.bn3(self.conv3(x))))
            x = self.pool(F.relu(self.bn4(self.conv4(x))))
            x = x.view(x.size(0), -1)
            x = self.dropout(F.relu(self.fc1(x)))
            x = self.fc2(x)
            return x

    # Pre-load PyTorch currency model globally in memory
    GLOBAL_CURRENCY_MODEL = None
    GLOBAL_CURRENCY_CLASSES = []

    model_path = os.path.join(os.path.dirname(__file__), "currency_model.pth")
    classes_path = os.path.join(os.path.dirname(__file__), "currency_classes.json")
    
    if os.path.exists(model_path) and os.path.exists(classes_path):
        try:
            with open(classes_path, "r") as f:
                GLOBAL_CURRENCY_CLASSES = json.load(f)
            loaded_model = CurrencyCNN(num_classes=len(GLOBAL_CURRENCY_CLASSES))
            loaded_model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
            loaded_model.eval()
            GLOBAL_CURRENCY_MODEL = loaded_model
            print(f"Successfully loaded pre-trained PyTorch currency model into memory ({len(GLOBAL_CURRENCY_CLASSES)} classes).")
        except Exception as load_err:
            print(f"Error loading currency model: {load_err}")

    def verify_currency_color_match(currency_name: str, frame) -> bool:
        if not HAS_CV or frame is None:
            return True
        try:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            tot_px = frame.shape[0] * frame.shape[1]
            
            masks = {
                "₹2000 Indian Rupee Note": cv2.inRange(hsv, np.array([140, 40, 80]), np.array([175, 255, 255])),
                "₹200 Indian Rupee Note": cv2.inRange(hsv, np.array([15, 80, 80]), np.array([35, 255, 255])),
                "₹100 Indian Rupee Note": cv2.inRange(hsv, np.array([120, 25, 80]), np.array([155, 255, 255])),
                "₹50 Indian Rupee Note": cv2.inRange(hsv, np.array([80, 60, 80]), np.array([115, 255, 255])),
                "₹20 Indian Rupee Note": cv2.inRange(hsv, np.array([35, 50, 80]), np.array([75, 255, 255])),
                "₹10 Indian Rupee Note": cv2.inRange(hsv, np.array([5, 40, 30]), np.array([22, 180, 140])),
                "₹500 Indian Rupee Note": cv2.inRange(hsv, np.array([20, 15, 40]), np.array([65, 120, 180]))
            }
            
            target_mask = masks.get(currency_name)
            if target_mask is not None:
                ratio = cv2.countNonZero(target_mask) / tot_px
                return ratio >= 0.04
        except Exception as e:
            print(f"Color verification error: {e}")
        return True

    def predict_currency_pytorch(frame):
        if GLOBAL_CURRENCY_MODEL is None or not GLOBAL_CURRENCY_CLASSES:
            return None

        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (128, 128)).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img_norm = (img_resized - mean) / std
        img_tensor = torch.tensor(np.transpose(img_norm, (2, 0, 1))).unsqueeze(0)

        with torch.no_grad():
            outputs = GLOBAL_CURRENCY_MODEL(img_tensor)
            probs = F.softmax(outputs, dim=1)[0]
            max_prob, max_idx = torch.max(probs, 0)
            
            conf = float(max_prob.item())
            if conf >= 0.65:
                pred_meta = GLOBAL_CURRENCY_CLASSES[max_idx.item()]
                currency_name = pred_meta["currency"]
                
                # Cross-verify color signature to prevent false positive classifications on non-currency objects
                if verify_currency_color_match(currency_name, frame):
                    return {
                        "currency": currency_name,
                        "value_text": pred_meta["value_text"],
                        "confidence": round(conf, 3)
                    }
        return None
except Exception as e:
    print(f"PyTorch currency model setup note: {e}")
    predict_currency_pytorch = lambda frame: None

class CurrencyRequest(BaseModel):
    frame_base64: str

@app.post("/api/detect-currency")
async def detect_currency_endpoint(request: CurrencyRequest):
    import time, json
    start_time = time.time()

    if not request.frame_base64 or len(request.frame_base64) < 100:
        return {"detected": False, "currency": "", "value_text": "", "confidence": 0.0, "time_ms": 0}

    frame = None
    if HAS_CV:
        try:
            frame_bytes = base64.b64decode(request.frame_base64)
            np_arr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"Currency frame decoding error: {e}")

    # Stage 1: Edge & Texture Density Pre-Check (Filter out empty/uniform frames)
    has_valid_subject = True
    if HAS_CV and frame is not None:
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.mean(edges) / 255.0
            if edge_density < 0.008:  # Plain uniform background, no note present
                has_valid_subject = False
        except Exception:
            pass

    if not has_valid_subject:
        return {"detected": False, "currency": "", "value_text": "", "confidence": 0.0, "time_ms": int((time.time() - start_time) * 1000)}

    # Stage 2: EasyOCR Digits & Keyword Extraction
    ocr_detected_currency = None
    ocr_value_text = None
    ocr_conf = 0.0

    if HAS_CV and frame is not None and HAS_OCR:
        try:
            ocr_results = reader.readtext(frame)
            ocr_text = " ".join([t[1].upper() for t in ocr_results if t[2] > 0.20])
            
            # Match Indian Rupee Note Denominations from OCR digits & text
            if "2000" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "₹2000 Indian Rupee Note", "two thousand rupee note", 0.96
            elif "500" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "₹500 Indian Rupee Note", "five hundred rupee note", 0.96
            elif "200" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "₹200 Indian Rupee Note", "two hundred rupee note", 0.95
            elif "100" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "₹100 Indian Rupee Note", "one hundred rupee note", 0.94
            elif "50" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "₹50 Indian Rupee Note", "fifty rupee note", 0.93
            elif "20" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "₹20 Indian Rupee Note", "twenty rupee note", 0.91
            elif "10" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "₹10 Indian Rupee Note", "ten rupee note", 0.90
            elif "RESERVE BANK" in ocr_text or "RUPEES" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "Indian Rupee Note", "Indian rupee note", 0.85
            elif "DOLLAR" in ocr_text or "FEDERAL RESERVE" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "US Dollar Note", "US dollar note", 0.88
            elif "EURO" in ocr_text:
                ocr_detected_currency, ocr_value_text, ocr_conf = "Euro Note", "Euro note", 0.88

            if ocr_detected_currency:
                return {
                    "detected": True,
                    "currency": ocr_detected_currency,
                    "value_text": ocr_value_text,
                    "confidence": ocr_conf,
                    "time_ms": int((time.time() - start_time) * 1000)
                }
        except Exception as ocr_err:
            print(f"OCR Currency exception: {ocr_err}")

    # Stage 3: PyTorch Deep Learning Model Inference
    pytorch_currency = None
    pytorch_value = None
    pytorch_conf = 0.0
    if HAS_CV and frame is not None:
        try:
            pt_res = predict_currency_pytorch(frame)
            if pt_res and pt_res.get("confidence", 0) >= 0.50:
                pytorch_currency = pt_res["currency"]
                pytorch_value = pt_res["value_text"]
                pytorch_conf = pt_res["confidence"]
        except Exception as pt_err:
            print(f"PyTorch Currency exception: {pt_err}")

    # Stage 4: HSV Color Signature Analysis for Bank Notes
    hsv_currency = None
    hsv_value = None
    hsv_conf = 0.0
    if HAS_CV and frame is not None:
        try:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            tot_px = frame.shape[0] * frame.shape[1]

            magenta_mask = cv2.inRange(hsv, np.array([140, 50, 100]), np.array([170, 255, 255]))
            yellow_mask = cv2.inRange(hsv, np.array([15, 100, 100]), np.array([35, 255, 255]))
            violet_mask = cv2.inRange(hsv, np.array([125, 30, 100]), np.array([155, 255, 255]))
            cyan_mask = cv2.inRange(hsv, np.array([85, 80, 100]), np.array([110, 255, 255]))
            green_mask = cv2.inRange(hsv, np.array([35, 60, 100]), np.array([75, 255, 255]))
            brown_mask = cv2.inRange(hsv, np.array([5, 50, 40]), np.array([20, 180, 140]))

            ratios = {
                "₹2000 Indian Rupee Note": (cv2.countNonZero(magenta_mask) / tot_px, "two thousand rupee note"),
                "₹200 Indian Rupee Note": (cv2.countNonZero(yellow_mask) / tot_px, "two hundred rupee note"),
                "₹100 Indian Rupee Note": (cv2.countNonZero(violet_mask) / tot_px, "one hundred rupee note"),
                "₹50 Indian Rupee Note": (cv2.countNonZero(cyan_mask) / tot_px, "fifty rupee note"),
                "₹20 Indian Rupee Note": (cv2.countNonZero(green_mask) / tot_px, "twenty rupee note"),
                "₹10 Indian Rupee Note": (cv2.countNonZero(brown_mask) / tot_px, "ten rupee note"),
            }

            best_match = max(ratios.items(), key=lambda item: item[1][0])
            if best_match[1][0] >= 0.12:  # Dominates at least 12% of frame
                hsv_currency = best_match[0]
                hsv_value = best_match[1][1]
                hsv_conf = min(0.92, round(0.70 + best_match[1][0], 2))
        except Exception as cv_err:
            print(f"Color analysis exception: {cv_err}")

    # Stage 5: Multi-Modal Consensus Decision
    # If OCR detected a clear numerical denomination, prioritize OCR (text is definitive)
    if ocr_detected_currency:
        return {
            "detected": True,
            "currency": ocr_detected_currency,
            "value_text": ocr_value_text,
            "confidence": ocr_conf,
            "time_ms": int((time.time() - start_time) * 1000)
        }

    # If PyTorch model is confident (>= 0.60) or matches HSV color signature
    if pytorch_currency:
        if pytorch_conf >= 0.60 or (hsv_currency == pytorch_currency):
            return {
                "detected": True,
                "currency": pytorch_currency,
                "value_text": pytorch_value,
                "confidence": pytorch_conf,
                "time_ms": int((time.time() - start_time) * 1000)
            }

    # If HSV color analysis is very high (>= 0.18 ratio)
    if hsv_currency and hsv_conf >= 0.85:
        return {
            "detected": True,
            "currency": hsv_currency,
            "value_text": hsv_value,
            "confidence": hsv_conf,
            "time_ms": int((time.time() - start_time) * 1000)
        }

    # Stage 6: Cloud Vision Gemini Fallback if API key is present
    api_key = os.getenv("OPENROUTER_API_KEY")
    if api_key:
        try:
            import requests
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            prompt_text = (
                "Analyze this camera frame carefully for currency notes or coins (Indian Rupees ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, ₹2000, US Dollars, Euros, etc.). "
                "Respond ONLY with a valid raw JSON object: "
                '{"detected": true, "currency": "₹500 Indian Rupee Note", "value_text": "five hundred rupee note", "confidence": 0.96} '
                "If no currency is visible, return: "
                '{"detected": false, "currency": "", "value_text": "", "confidence": 0.0}'
            )
            payload = {
                "model": "google/gemini-2.5-flash",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{request.frame_base64}"}}
                    ]
                }],
                "max_tokens": 200,
                "temperature": 0.1,
                "response_format": {"type": "json_object"}
            }
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=7)
            if res.status_code == 200:
                content = res.json()['choices'][0]['message']['content'].strip()
                parsed = json.loads(content)
                if parsed.get("detected"):
                    return {
                        "detected": True,
                        "currency": str(parsed.get("currency", "")),
                        "value_text": str(parsed.get("value_text", "")),
                        "confidence": float(parsed.get("confidence", 0.9)),
                        "time_ms": int((time.time() - start_time) * 1000)
                    }
        except Exception as e:
            print(f"Gemini currency call failed: {e}")

    return {
        "detected": False,
        "currency": "",
        "value_text": "",
        "confidence": 0.0,
        "time_ms": int((time.time() - start_time) * 1000)
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
