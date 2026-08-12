import { motion } from 'framer-motion';
import {
  Eye, Scan, MapPin, Mic, Bell, Palette, DollarSign, Users,
  Zap, Brain, Camera, Volume2, Shield, Cpu, Code2, Database,
  Github, Mail, Phone, ArrowRight, Activity, Glasses,
} from 'lucide-react';

interface LandingPageProps {
  onStartDemo: () => void;
}

const features = [
  { icon: Scan, title: 'Object Detection', desc: 'Real-time identification of people, furniture, vehicles, and everyday objects with position and distance estimation.' },
  { icon: Volume2, title: 'OCR & Text Reading', desc: 'Reads books, medicine labels, notices, sign boards, and street names aloud using advanced text recognition.' },
  { icon: Eye, title: 'Scene Description', desc: 'AI-powered descriptions of indoor and outdoor environments to provide full spatial awareness and context.' },
  { icon: Brain, title: 'Gemini AI Assistant', desc: 'Ask anything — GK questions, current affairs, general knowledge — and get instant spoken answers powered by Google Gemini.' },
  { icon: MapPin, title: 'GPS Voice Navigation', desc: 'Voice-activated turn-by-turn navigation to any destination in English and regional Indian languages (Hindi, Tamil, Telugu, Kannada).' },
  { icon: Users, title: 'Face Recognition', desc: 'Register and recognize familiar faces, announcing who is nearby for social confidence.' },
  { icon: DollarSign, title: 'Currency Recognition', desc: 'Expert-level identification of all Indian currency notes (₹10 to ₹2000) with denomination-specific visual analysis.' },
  { icon: Palette, title: 'Color Recognition', desc: 'Detects and speaks colors of objects, clothing, and surroundings for independent dressing and shopping.' },
  { icon: Mic, title: 'Voice Commands', desc: 'Hands-free control with natural language in English and Indian regional languages. Wake word: "Hey Vision".' },
  { icon: Bell, title: 'Emergency Mode', desc: 'One-tap SOS button sends location and emergency messages to registered contacts instantly.' },
  { icon: MapPin, title: 'Traffic & Zebra Crossing', desc: 'Real-time detection of traffic light colors and zebra crossings with audio safety alerts for road crossings.' },
  { icon: Zap, title: 'Obstacle Warning', desc: 'Estimates obstacle distance using computer vision, giving immediate warnings about near, medium, and far hazards.' },
];


const technologies = [
  { icon: Brain, name: 'Google Gemini 2.5 Flash', desc: 'Powers AI Q&A, scene understanding, OCR, and currency detection via OpenRouter' },
  { icon: Scan, name: 'COCO-SSD / YOLO v8', desc: 'In-browser & server-side real-time object detection with distance estimation' },
  { icon: Camera, name: 'WebRTC', desc: 'Live webcam streaming as the glasses camera with frame capture' },
  { icon: Volume2, name: 'Web Speech API', desc: 'Continuous speech recognition with silence debounce + multilingual TTS output' },
  { icon: MapPin, name: 'OpenStreetMap + OSRM', desc: 'Free open-source GPS navigation with walking route planning and turn-by-turn steps' },
  { icon: Database, name: 'Supabase', desc: 'Cloud database for detection history, settings sync, and edge function AI calls' },
  { icon: Cpu, name: 'FastAPI Python Backend', desc: 'Local server for YOLO, EasyOCR, traffic light CV, and Gemini Q&A fallback' },
  { icon: Code2, name: 'Modular Architecture', desc: 'Ready for Raspberry Pi camera & sensor swap with no AI logic changes' },
];


const benefits = [
  { icon: Shield, title: 'Independence', desc: 'Navigate daily life without constant assistance from others.' },
  { icon: Zap, title: 'Real-Time', desc: 'Instant feedback with sub-second AI processing on every frame.' },
  { icon: Activity, title: 'Spatial Awareness', desc: 'Understand your surroundings with distance and position info.' },
  { icon: Eye, title: 'Accessibility', desc: 'Designed for visually impaired users with voice-first interaction.' },
];

const team = [
  { name: 'Project Lead', role: 'AI & Computer Vision', initials: 'PL' },
  { name: 'Hardware Lead', role: 'Raspberry Pi & Sensors', initials: 'HL' },
  { name: 'Frontend Dev', role: 'React & UI/UX', initials: 'FD' },
  { name: 'Backend Dev', role: 'API & Database', initials: 'BD' },
];

export default function LandingPage({ onStartDemo }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Glasses className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">VisionAssist</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-primary-600 transition-colors">Features</a>
            <a href="#technology" className="hover:text-primary-600 transition-colors">Technology</a>
            <a href="#benefits" className="hover:text-primary-600 transition-colors">Benefits</a>
            <a href="#team" className="hover:text-primary-600 transition-colors">Team</a>
            <a href="#contact" className="hover:text-primary-600 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/visionassist-guardian/login.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:border-primary-500 hover:text-primary-600 transition-all"
            >
              Guardian Login
            </a>
            <button
              onClick={onStartDemo}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold text-sm shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-105"
            >
              Start Demo
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50 via-white to-white" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              AI-Powered Assistive Technology
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6">
              See the world through <span className="gradient-text">AI Smart Glasses</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
              VisionAssist simulates smart glasses using your laptop webcam as the camera.
              Real-time object detection, text reading, scene description, and voice feedback —
              all running in your browser. Built for hackathons and ready for hardware integration.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={onStartDemo}
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold shadow-xl shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-105 flex items-center gap-2"
              >
                Launch Live Demo <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#features"
                className="px-7 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-primary-300 hover:text-primary-600 transition-all flex items-center gap-2"
              >
                Explore Features
              </a>
            </div>
            <div className="flex gap-8 mt-10">
              <div>
                <div className="text-3xl font-bold text-primary-600">12+</div>
                <div className="text-sm text-slate-500">AI Features</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary-600">80+</div>
                <div className="text-sm text-slate-500">Object Classes</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary-600">8 langs</div>
                <div className="text-sm text-slate-500">Voice Support</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="relative w-full max-w-md mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-400/20 to-accent-400/20 rounded-3xl blur-2xl" />
              <div className="relative glass card-shadow rounded-3xl p-8">
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-pulse-ring" />
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center animate-float">
                      <Glasses className="w-16 h-16 text-white" />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {['Gemini AI Q&A', 'GPS Navigation', 'Currency Detection', 'Voice Commands', 'Object Detection', 'Scene Description'].map((item, i) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.12 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/60"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-success-500" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{item}</span>
                      <span className="ml-auto text-xs text-success-600 font-semibold">Active</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-bold mb-4">AI Features That Empower</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Twelve powerful AI capabilities — from Gemini-powered Q&A to GPS navigation — all accessible by voice.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-6 card-shadow hover:shadow-lg hover:shadow-primary-500/10 transition-all hover:-translate-y-1 border border-slate-100"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section id="technology" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-bold mb-4">Built With Modern Technology</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A modular architecture designed for today's demo and tomorrow's hardware.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {technologies.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-4 p-6 rounded-2xl bg-white border border-slate-100 card-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <t.icon className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{t.name}</h3>
                  <p className="text-sm text-slate-600">{t.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20 bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-bold mb-4">Real Impact for Real People</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              VisionAssist is designed to restore independence and confidence for visually impaired users.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="text-center p-6 rounded-2xl bg-white card-shadow border border-slate-100"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4">
                  <b.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold mb-2">{b.title}</h3>
                <p className="text-sm text-slate-600">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-gradient-to-br from-primary-600 to-accent-600 p-12 text-white text-center"
          >
            <Code2 className="w-12 h-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-3xl font-bold mb-4">About the Project</h2>
            <p className="text-lg leading-relaxed opacity-90 max-w-3xl mx-auto">
              VisionAssist is a college hackathon project that simulates AI-powered smart glasses
              for visually impaired users. The laptop webcam acts as the glasses camera, running
              real-time AI models entirely in the browser. The modular architecture ensures that
              when the physical Raspberry Pi prototype is built, only the camera and sensor inputs
              need to be replaced — the core AI logic remains unchanged.
            </p>
            <button
              onClick={onStartDemo}
              className="mt-8 px-8 py-3.5 rounded-xl bg-white text-primary-600 font-semibold hover:scale-105 transition-all shadow-lg"
            >
              Try the Live Demo
            </button>
          </motion.div>
        </div>
      </section>

      {/* Team */}
      <section id="team" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-bold mb-4">Meet the Team</h2>
            <p className="text-lg text-slate-600">The minds behind VisionAssist</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-6 text-center card-shadow border border-slate-100"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                  {m.initials}
                </div>
                <h3 className="font-bold">{m.name}</h3>
                <p className="text-sm text-slate-500">{m.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4">Get in Touch</h2>
            <p className="text-lg text-slate-600">Have questions about VisionAssist? Reach out to us.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Mail, label: 'Email', value: 'team@visionassist.ai' },
              { icon: Phone, label: 'Phone', value: '+91 98765 43210' },
              { icon: Github, label: 'GitHub', value: 'github.com/visionassist' },
            ].map((c) => (
              <div key={c.label} className="flex flex-col items-center p-6 rounded-2xl bg-white card-shadow border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-3">
                  <c.icon className="w-6 h-6 text-primary-600" />
                </div>
                <div className="text-sm text-slate-500 mb-1">{c.label}</div>
                <div className="font-semibold text-slate-700">{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Glasses className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">VisionAssist</span>
            </div>
            <p className="text-sm">AI Smart Glasses for Visually Impaired — Developed by PRIYAN</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
              <a href="#" className="hover:text-white transition-colors"><Mail className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
