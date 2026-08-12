import React from 'react';
import { Activity, Eye, Volume2, DollarSign, Mic, Clock } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'object' | 'ocr' | 'currency' | 'voice';
  title: string;
  details: string;
  timestamp: string;
}

const activityLogs: ActivityItem[] = [
  {
    id: '1',
    type: 'currency',
    title: 'Currency Identification',
    details: 'Identified ₹500 Indian Rupee Note with 96% confidence (Multi-modal AI).',
    timestamp: '10:30 AM'
  },
  {
    id: '2',
    type: 'ocr',
    title: 'OCR Board Reading',
    details: 'Read text aloud: "Apollo Pharmacy — Medical & Emergency Services"',
    timestamp: '10:28 AM'
  },
  {
    id: '3',
    type: 'object',
    title: 'Traffic & Obstacle Identification',
    details: 'Detected: Car (ahead, 3m), Pedestrian (right, 1.5m), Traffic Light (GREEN).',
    timestamp: '10:25 AM'
  },
  {
    id: '4',
    type: 'voice',
    title: 'Voice Command Processed',
    details: 'User asked: "Hey Vision, navigate to Apollo Hospital". Route calculated.',
    timestamp: '10:20 AM'
  }
];

export default function GuardianActivity() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600" />
            AI Activity & Real-Time Interaction Timeline
          </h2>
          <p className="text-xs text-slate-500 mt-1">Live telemetry of AI visual scans, spoken OCR, and voice interactions</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
        <div className="relative border-l-2 border-slate-100 pl-6 space-y-6 ml-3">
          {activityLogs.map(item => (
            <div key={item.id} className="relative">
              {/* Icon Marker */}
              <div className="absolute -left-9 top-0.5 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold ring-4 ring-white">
                {item.type === 'currency' && <DollarSign className="w-3.5 h-3.5" />}
                {item.type === 'ocr' && <Volume2 className="w-3.5 h-3.5" />}
                {item.type === 'object' && <Eye className="w-3.5 h-3.5" />}
                {item.type === 'voice' && <Mic className="w-3.5 h-3.5" />}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-900">{item.title}</h3>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {item.timestamp}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {item.details}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
