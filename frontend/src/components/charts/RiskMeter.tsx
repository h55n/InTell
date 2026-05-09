import { motion } from 'framer-motion';
import type { RiskLevel } from '../../types';

const RISK_CONFIG = {
  safe:           { label: 'SAFE',           color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',   icon: '🛡️' },
  suspicious:     { label: 'SUSPICIOUS',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)',  icon: '⚠️' },
  high_risk:      { label: 'HIGH RISK',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',   icon: '🚨' },
  confirmed_scam: { label: 'CONFIRMED SCAM', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.5)',   icon: '💀' },
};

interface RiskMeterProps {
  level: RiskLevel;
  score: number;
}

export function RiskMeter({ level, score }: RiskMeterProps) {
  const cfg = RISK_CONFIG[level];
  const angle = (score / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div
      className="rounded-2xl border p-6 text-center"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      {/* SVG Gauge */}
      <div className="relative w-40 h-20 mx-auto mb-3">
        <svg viewBox="0 0 160 90" className="w-full h-full">
          {/* Background arc */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="#27272a" strokeWidth="12" strokeLinecap="round" />
          {/* Score arc */}
          <motion.path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke={cfg.color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="220"
            initial={{ strokeDashoffset: 220 }}
            animate={{ strokeDashoffset: 220 - (score / 100) * 220 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
          {/* Needle */}
          <motion.line
            x1="80" y1="80" x2="80" y2="20"
            stroke={cfg.color}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ rotate: -90 }}
            animate={{ rotate: angle }}
            style={{ originX: '80px', originY: '80px' }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
          <circle cx="80" cy="80" r="5" fill={cfg.color} />
          {/* Labels */}
          <text x="10" y="90" fill="#71717a" fontSize="9" textAnchor="middle">0</text>
          <text x="150" y="90" fill="#71717a" fontSize="9" textAnchor="middle">100</text>
        </svg>
        {/* Score in center */}
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <motion.span
            className="mono text-2xl font-bold"
            style={{ color: cfg.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
        </div>
      </div>

      <div className="text-2xl mb-2">{cfg.icon}</div>
      <div className="mono font-bold text-lg tracking-widest" style={{ color: cfg.color }}>
        {cfg.label}
      </div>
    </div>
  );
}
