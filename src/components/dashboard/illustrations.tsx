/**
 * Hand-drawn flat SVG illustrations. Original artwork, no external assets.
 * Palette: hills greens, steel greys, process blue; sky comes from the parent.
 * All are decorative (aria-hidden) — meaning is always carried by text nearby.
 */

const G = { g1: "#9bd77f", g2: "#6cc06a", g3: "#3f9c56", g4: "#2c7a45", steel: "#e6edf6", steel2: "#c3cfde", steel3: "#8c9db4", blue: "#4f9cf7", blue2: "#2563eb", cloud: "#ffffff" };

function Cloud({ x, y, s = 1, className }: { x: number; y: number; s?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={className}>
      <ellipse cx="0" cy="10" rx="34" ry="11" fill={G.cloud} />
      <circle cx="-12" cy="2" r="12" fill={G.cloud} />
      <circle cx="8" cy="-2" r="16" fill={G.cloud} />
      <circle cx="24" cy="6" r="9" fill={G.cloud} />
    </g>
  );
}

function Pine({ x, y, s = 1, c = G.g4 }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-1.5" y="18" width="3" height="8" fill="#6b4f3a" />
      <path d="M0 -14 L10 4 L5 4 L13 18 L-13 18 L-5 4 L-10 4 Z" fill={c} />
    </g>
  );
}

/** Right-panel scene: hills, a stainless bioreactor with a sight glass, pipes, trees, birds. */
export function ReactorLandscape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 300" className={className} aria-hidden focusable="false">
      <Cloud x={60} y={40} s={0.9} className="drift" />
      <Cloud x={290} y={70} s={0.7} className="drift" />
      {/* birds */}
      <g stroke="#3f6fb5" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M150 52 q5 -5 10 0 q5 -5 10 0" />
        <path d="M182 40 q4 -4 8 0 q4 -4 8 0" />
        <path d="M205 60 q3 -3 6 0 q3 -3 6 0" />
      </g>

      {/* far hills */}
      <path d="M0 190 Q70 140 140 175 T290 150 T360 165 V300 H0 Z" fill={G.g1} />
      {/* bioreactor */}
      <g transform="translate(196 92)">
        <rect x="8" y="128" width="6" height="34" fill={G.steel3} />
        <rect x="62" y="128" width="6" height="34" fill={G.steel3} />
        <path d="M0 30 Q0 0 38 0 Q76 0 76 30 V120 Q76 140 38 140 Q0 140 0 120 Z" fill={G.steel} />
        <path d="M54 4 Q76 8 76 30 V120 Q76 136 60 139 Z" fill={G.steel2} />
        <rect x="-2" y="26" width="80" height="6" rx="3" fill={G.steel2} />
        {/* sight glass */}
        <rect x="22" y="48" width="22" height="70" rx="11" fill="#d5e7ff" />
        <path d="M22 78 H44 V107 A11 11 0 0 1 22 107 Z" fill={G.blue} />
        <circle cx="30" cy="96" r="2.5" fill="#cfe3ff" />
        <circle cx="36" cy="88" r="1.8" fill="#cfe3ff" />
        <circle cx="31" cy="84" r="1.4" fill="#cfe3ff" />
        {/* gauge + motor */}
        <circle cx="58" cy="60" r="7" fill="#fff" stroke={G.steel3} strokeWidth="2" />
        <path d="M58 60 L62 56" stroke={G.blue2} strokeWidth="2" strokeLinecap="round" />
        <rect x="30" y="-14" width="16" height="14" rx="3" fill={G.steel3} />
        <rect x="35" y="-20" width="6" height="7" rx="2" fill={G.steel2} />
        {/* pipe to holding tank */}
        <path d="M76 110 H104 V128" stroke={G.steel3} strokeWidth="5" fill="none" strokeLinejoin="round" />
        <rect x="94" y="128" width="28" height="34" rx="6" fill={G.steel} />
        <rect x="94" y="140" width="28" height="4" fill={G.blue} opacity="0.8" />
      </g>
      {/* near hills */}
      <path d="M0 230 Q90 190 180 225 T360 215 V300 H0 Z" fill={G.g2} />
      <path d="M0 262 Q120 236 240 258 T360 250 V300 H0 Z" fill={G.g3} />
      <Pine x={40} y={200} s={1.1} />
      <Pine x={66} y={208} s={0.85} c={G.g3} />
      <Pine x={318} y={196} s={1.05} />
      <Pine x={340} y={206} s={0.8} c={G.g3} />
      {/* path */}
      <path d="M170 300 Q190 270 230 262" stroke="#e9dcc2" strokeWidth="10" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Low rolling-hills strip that stretches to any width (used when the panel is wide and short). */
export function HillsBand({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 80" preserveAspectRatio="none" className={className} aria-hidden focusable="false">
      <path d="M0 40 Q100 10 200 34 T400 26 T600 30 V80 H0 Z" fill={G.g1} />
      <path d="M0 56 Q150 32 300 52 T600 46 V80 H0 Z" fill={G.g2} />
      <path d="M0 70 Q200 56 400 68 T600 64 V80 H0 Z" fill={G.g3} />
    </svg>
  );
}

/** Promo card: Erlenmeyer flask with bubbling liquid on a hill. */
export function FlaskScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden focusable="false">
      <Cloud x={50} y={36} s={0.6} className="drift" />
      <Cloud x={196} y={22} s={0.45} />
      <path d="M0 150 Q60 118 120 140 T240 130 V190 H0 Z" fill={G.g2} />
      <path d="M0 172 Q80 152 160 168 T240 164 V190 H0 Z" fill={G.g3} />
      <g transform="translate(92 40)">
        <path d="M18 0 H38 V36 L60 92 Q63 104 50 104 H6 Q-7 104 -4 92 L18 36 Z" fill="#ffffff" opacity="0.92" />
        <path d="M6 66 H50 L58 90 Q61 101 50 101 H6 Q-5 101 -2 90 Z" fill={G.blue} />
        <path d="M6 66 Q28 60 50 66" stroke="#9cc8ff" strokeWidth="3" fill="none" />
        <rect x="14" y="-6" width="28" height="8" rx="4" fill={G.steel3} />
        <circle cx="20" cy="86" r="4" fill="#cfe3ff" />
        <circle cx="34" cy="78" r="3" fill="#cfe3ff" />
        <circle cx="40" cy="91" r="2.4" fill="#cfe3ff" />
        <circle cx="28" cy="50" r="3" fill="#cfe3ff" opacity="0.9" />
        <circle cx="34" cy="30" r="2.2" fill="#cfe3ff" opacity="0.7" />
      </g>
      {/* leaves */}
      <path d="M60 150 q-6 -24 14 -34 q4 22 -14 34 Z" fill={G.g4} />
      <path d="M176 146 q2 -22 22 -26 q-2 22 -22 26 Z" fill={G.g4} />
    </svg>
  );
}

/** "Profile picture" for the enzyme: a GOS chain (three linked sugar rings). */
export function GosAvatar({ className }: { className?: string }) {
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden focusable="false">
      <circle cx="60" cy="60" r="58" fill="#ffe8b3" />
      <circle cx="60" cy="60" r="46" fill="#fff4d6" />
      <g strokeLinejoin="round" strokeWidth="4">
        <polygon points={hex(36, 66, 15)} fill="#2563eb" stroke="#1d4ed8" />
        <polygon points={hex(62, 52, 15)} fill="#5aa7f5" stroke="#2563eb" />
        <polygon points={hex(88, 66, 15)} fill="#93c5fd" stroke="#2563eb" />
      </g>
      <g stroke="#1b2541" strokeWidth="3" strokeLinecap="round">
        <path d="M49 60 L50 58" />
        <path d="M75 58 L76 60" />
      </g>
      <circle cx="36" cy="66" r="3.5" fill="#fff" />
      <circle cx="62" cy="52" r="3.5" fill="#fff" />
      <circle cx="88" cy="66" r="3.5" fill="#fff" />
    </svg>
  );
}

/**
 * Small thumbnail for a set of conditions: a landscape whose sun grows with
 * temperature and whose water level rises with lactose loading.
 */
export function ConditionThumb({ temperature, lactose, className }: { temperature: number; lactose: number; className?: string }) {
  const t = Math.min(1, Math.max(0, (temperature - 65) / 25));
  const l = Math.min(1, Math.max(0, (lactose - 300) / 600));
  const sky = t > 0.66 ? "#ffd8a8" : t > 0.33 ? "#cfe6ff" : "#dff1ff";
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden focusable="false">
      <rect width="56" height="56" rx="14" fill={sky} />
      <circle cx="40" cy="16" r={5 + t * 6} fill={t > 0.66 ? "#f97316" : "#fbbf24"} />
      <path d="M0 36 Q14 26 28 33 T56 30 V56 H0 Z" fill={G.g2} />
      <path d={`M0 ${50 - l * 10} Q28 ${44 - l * 10} 56 ${50 - l * 10} V56 H0 Z`} fill={G.blue} opacity="0.85" />
      <Pine x={14} y={26} s={0.45} />
    </svg>
  );
}
