import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak

def generate_full_pdf():
    pdf_filename = r"c:\Users\shaisty priya\Downloads\ai glass\project\VisionAssist_Full_File_System_Guide.pdf"
    
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=colors.HexColor('#1e3a8a'), spaceAfter=4)
    subtitle_style = ParagraphStyle('DocSubTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=colors.HexColor('#2563eb'), spaceAfter=12)
    h2_style = ParagraphStyle('Heading2_Custom', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=colors.HexColor('#0f172a'), spaceBefore=12, spaceAfter=6)
    file_title_style = ParagraphStyle('FileTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=colors.HexColor('#1d4ed8'))
    body_style = ParagraphStyle('Body_Custom', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#334155'), spaceAfter=5)
    bullet_style = ParagraphStyle('Bullet_Custom', parent=body_style, leftIndent=12, firstLineIndent=-8, spaceAfter=3)

    story = []

    # Title
    story.append(Paragraph("VisionAssist Smart Glasses System", title_style))
    story.append(Paragraph("Complete Line-by-Line & File-by-File Technical Guide", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563eb'), spaceAfter=10))

    # Introduction
    story.append(Paragraph("System Architecture Overview", h2_style))
    story.append(Paragraph(
        "This guide details every single file across the <b>VisionAssist</b> smart glasses codebase. "
        "The architecture combines React 18 & TypeScript frontend UI, FastAPI & PyTorch Deep Learning backend microservices, YOLOv8 object detection, OpenCV computer vision pipelines, and Supabase serverless edge functions.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # File Sections
    sections = [
        ("1. Backend Microservices (backend/)", [
            ("backend/main.py", "Primary FastAPI Python server. Features PyTorch Currency CNN inference (<50ms), YOLOv8 object detection, OpenCV traffic light color spectrum (HSV) parsing, zebra crossing Hough line transforms, EasyOCR text extraction, Gemini OpenRouter integration, and pyttsx3/Sphinx offline speech engine."),
            ("backend/train_currency_model.py", "Deep learning PyTorch training script. Defines 4-stage CurrencyCNN, preprocesses dataset images from archive (7), trains model for 20 epochs with Adam optimizer, achieved 83.33% Test Accuracy, and outputs currency_model.pth."),
            ("backend/currency_model.pth", "Saved PyTorch binary weights checkpoint file for 7-class Indian currency note classification."),
            ("backend/currency_classes.json", "Metadata mapping 7 neural network class indices to human-readable denomination labels (₹100, ₹200, ₹2000, ₹500, ₹50, ₹10, ₹20).")
        ]),
        ("2. Frontend Components (src/components/)", [
            ("src/components/Dashboard.tsx", "Primary Smart Glasses Heads-Up Display (HUD). Features live camera feed canvas, bounding box renderer, navigation HUD, Currency Scanner card with 'Scan Now' button, voice visualizer, emergency SOS trigger, and settings modal."),
            ("src/components/LandingPage.tsx", "Marketing showcase page highlighting smart glasses features, AI technologies, hardware specs, and system capabilities."),
            ("src/components/MapPanel.tsx", "Interactive Leaflet GPS map rendering current user position, walking route polyline, destination marker, and map style toggles.")
        ]),
        ("3. Frontend Core Libraries (src/lib/)", [
            ("src/lib/detection.ts", "Client-side vision library. Captures JPEG frames from video, handles detectCurrency() failover, runs local COCO-SSD detection, and renders glowing bounding boxes."),
            ("src/lib/speech.ts", "Multi-lingual speech engine. Translates announcements and voice commands into English, Tamil, Hindi, Telugu, and Kannada."),
            ("src/lib/VoiceEngine.ts", "Web Speech Synthesis API wrapper managing voice queue, pitch, rate, and speech event listeners."),
            ("src/lib/maps.ts", "GPS navigation library calculating walking distances, ETA, step-by-step turn directions, and location geocoding."),
            ("src/lib/supabase.ts", "Supabase client setup and database TypeScript interface definitions."),
            ("src/lib/storage.ts", "LocalStorage helper utility for persistent application state and offline caching.")
        ]),
        ("4. App Core & Root Files (src/ & root)", [
            ("src/App.tsx", "Root React application router managing view switching between Landing Page and Dashboard."),
            ("src/main.tsx", "Entry point mounting React DOM root into index.html."),
            ("src/index.css", "Global Tailwind CSS styles, Inter fonts, glassmorphism utilities, and keyframe animations."),
            ("supabase/functions/vision-analyze/index.ts", "Serverless Deno Edge Function proxying Gemini 2.5 Flash Vision requests."),
            ("supabase/migrations/*.sql", "PostgreSQL database schemas for detection logs, emergency contacts, and config."),
            ("generate_pdf_report.py", "Python ReportLab script programmatically creating PDF documentation."),
            ("package.json & vite.config.ts", "NPM package manifest and Vite build tool configuration.")
        ])
    ]

    for sec_title, files in sections:
        story.append(Paragraph(sec_title, h2_style))
        for fname, desc in files:
            story.append(Paragraph(f"• <b>{fname}</b>", file_title_style))
            story.append(Paragraph(desc, bullet_style))
        story.append(Spacer(1, 4))

    doc.build(story)
    print(f"Full File Guide PDF generated at: {pdf_filename}")

if __name__ == "__main__":
    generate_full_pdf()
