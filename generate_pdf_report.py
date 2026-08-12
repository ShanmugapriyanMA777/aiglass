import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether

def generate_pdf():
    pdf_filename = r"c:\Users\shaisty priya\Downloads\ai glass\project\VisionAssist_Software_Report.pdf"
    
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1e3a8a'),
        alignment=0,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#3b82f6'),
        spaceAfter=15
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=14,
        spaceAfter=8
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    th_style = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=colors.white)
    td_style = ParagraphStyle('TD', fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#1e293b'))

    story = []

    # Header section
    story.append(Paragraph("VisionAssist Smart Glasses System", title_style))
    story.append(Paragraph("Comprehensive Software Stack & Technical Architecture Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563eb'), spaceAfter=12))

    # Executive Overview
    story.append(Paragraph("1. Executive Overview", h2_style))
    story.append(Paragraph(
        "<b>VisionAssist</b> is an AI-powered smart glasses software platform engineered to empower visually impaired and blind users with real-time independence. "
        "The system integrates cutting-edge deep learning, computer vision, optical character recognition (OCR), multi-lingual voice feedback, and GPS navigation. "
        "This document details all software components, frameworks, AI models, and APIs used in the architecture.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # Master Software Stack Table
    story.append(Paragraph("2. Software Stack Summary Table", h2_style))
    
    table_data = [
        [Paragraph("Category", th_style), Paragraph("Software / Library", th_style), Paragraph("Version / Provider", th_style), Paragraph("Primary Role & Purpose", th_style)],
        
        [Paragraph("<b>Deep Learning AI</b>", td_style), Paragraph("PyTorch", td_style), Paragraph("2.11.0", td_style), Paragraph("Custom Currency CNN neural network trained on dataset for high-accuracy note classification.", td_style)],
        [Paragraph("<b>Generative AI</b>", td_style), Paragraph("Google Gemini 2.5 Flash", td_style), Paragraph("OpenRouter API", td_style), Paragraph("Multimodal AI for holistic scene description, voice Q&A companion, and currency validation.", td_style)],
        [Paragraph("<b>Object Detection</b>", td_style), Paragraph("YOLOv8 (Ultralytics)", td_style), Paragraph("YOLOv8 Nano", td_style), Paragraph("Real-time identification of pedestrians, cars, buses, obstacles, traffic lights, and zebra crossings.", td_style)],
        [Paragraph("<b>Computer Vision</b>", td_style), Paragraph("OpenCV & EasyOCR", td_style), Paragraph("4.11.0 / EasyOCR", td_style), Paragraph("Text recognition from signs/labels, traffic light color spectrum (HSV) detection, and color extraction.", td_style)],
        [Paragraph("<b>Backend Server</b>", td_style), Paragraph("FastAPI & Uvicorn", td_style), Paragraph("Python 3.11", td_style), Paragraph("High-speed asynchronous microservice engine processing camera frame payloads.", td_style)],
        [Paragraph("<b>Cloud & Database</b>", td_style), Paragraph("Supabase Edge Functions", td_style), Paragraph("PostgreSQL / Deno", td_style), Paragraph("Serverless cloud proxy, user state management, and configuration store.", td_style)],
        [Paragraph("<b>Frontend Framework</b>", td_style), Paragraph("React 18 & TypeScript", td_style), Paragraph("Vite Build Tool", td_style), Paragraph("Ultra-responsive user interface, interactive dashboard, HUD visualizers, and state engine.", td_style)],
        [Paragraph("<b>Maps & GPS</b>", td_style), Paragraph("Leaflet & OpenStreetMap", td_style), Paragraph("OpenSource GIS", td_style), Paragraph("Interactive navigation map panel, geocoding destination lookup, and turn-by-turn routing.", td_style)],
        [Paragraph("<b>Speech & Voice</b>", td_style), Paragraph("Web Speech API & pyttsx3", td_style), Paragraph("HTML5 / Offline TTS", td_style), Paragraph("Hands-free voice command parsing and spoken voice notifications in multiple languages.", td_style)],
    ]

    t = Table(table_data, colWidths=[90, 110, 85, 255])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    # Detailed Software Breakdown
    story.append(Paragraph("3. Detailed Software Breakdown & Architecture", h2_style))
    
    components = [
        ("A. PyTorch Deep Learning Currency Engine", [
            "<b>Role:</b> High-speed local neural network for Indian currency note classification.",
            "<b>Dataset:</b> Trained on custom dataset containing ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, and ₹2000 notes.",
            "<b>Architecture:</b> 4-stage Convolutional Neural Network (CNN) with Batch Normalization, Max Pooling, and Dropout regularization.",
            "<b>Performance:</b> Delivers predictions in under 50ms without requiring internet connection."
        ]),
        ("B. Google Gemini 2.5 Flash Multimodal AI", [
            "<b>Role:</b> Primary cloud vision AI partner.",
            "<b>Features:</b> Provides human-like holistic scene descriptions (e.g. 'You are in a hallway...'), answers open-ended user questions via natural voice Q&A, and translates camera readings.",
            "<b>Integration:</b> Connects via OpenRouter REST endpoint with multi-lingual prompt conditioning."
        ]),
        ("C. Ultralytics YOLOv8 & OpenCV Engine", [
            "<b>Role:</b> Real-time safety hazard & object detector.",
            "<b>Capabilities:</b> Scans video streams at up to 30 FPS for nearby pedestrians, moving vehicles, traffic lights, and zebra crossings.",
            "<b>HSV Pipeline:</b> Processes hue, saturation, and brightness values of traffic lights to confirm RED, YELLOW, or GREEN states."
        ]),
        ("D. Multi-Lingual Speech & Voice Engine", [
            "<b>Supported Languages:</b> English, Tamil (தமிழ்), Hindi (हिंदी), Telugu (తెలుగు), Kannada (கன்னட).",
            "<b>Text-To-Speech (TTS):</b> Native browser Web Speech Synthesis for crystal-clear audio announcements.",
            "<b>Voice Commands:</b> Enables hands-free navigation, feature triggers, and emergency SOS alerts."
        ]),
        ("E. Leaflet GPS Navigation & Geocoding", [
            "<b>Role:</b> Turn-by-turn walking guidance.",
            "<b>Functionality:</b> Calculates distance, estimated time of arrival (ETA), current road name, and destination door number matching via OCR."
        ])
    ]

    for title, points in components:
        story.append(Paragraph(title, ParagraphStyle('H3_Custom', parent=body_style, fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#1d4ed8'))))
        for pt in points:
            story.append(Paragraph(f"• {pt}", bullet_style))
        story.append(Spacer(1, 6))

    # System Safety & Privacy
    story.append(Paragraph("4. Reliability & Privacy Design", h2_style))
    story.append(Paragraph(
        "The software architecture enforces a <b>hybrid offline/online design</b>. Critical safety features (obstacle warning, currency identification via PyTorch, OCR, traffic light sensing) run locally on-device for ultra-fast latency and continuous operation even in offline areas. Cloud AI models are used to enhance conversational detail when connected.",
        body_style
    ))

    # Build PDF
    doc.build(story)
    print(f"PDF generated successfully at: {pdf_filename}")

if __name__ == "__main__":
    generate_pdf()
