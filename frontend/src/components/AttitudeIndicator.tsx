import type { AttitudeIndicatorProps } from '../interfaces/components';
import { clamp } from '../utils/formatters';

const PITCH_PIXELS_PER_DEGREE = 2;
const PITCH_CLAMP_DEGREES     = 40;
const CROSSHAIR_ARM_OUTER     = 22;
const CROSSHAIR_ARM_INNER     = 6;
const PITCH_LINE_MAJOR_HALF   = 20;
const PITCH_LINE_MINOR_HALF   = 12;
const PITCH_LINE_STEP         = 10;
const PITCH_LINES             = [-20, -10, 10, 20];
const ROLL_TICK_ANGLES        = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
const ROLL_TICK_OUTER_R       = 0.88; // fraction of radius
const ROLL_TICK_INNER_MAJOR_R = 0.78;
const ROLL_TICK_INNER_MINOR_R = 0.82;
const ROLL_TRIANGLE_SIZE      = 5;

export default function AttitudeIndicator({ roll = 0, pitch = 0, size = 128 }: AttitudeIndicatorProps) {
  const center = size / 2;
  const radius = center - 2;

  const pitchPx = clamp(pitch * PITCH_PIXELS_PER_DEGREE, -PITCH_CLAMP_DEGREES, PITCH_CLAMP_DEGREES);
  const clipId  = 'adi-clip';

  return (
    <svg width={size} height={size} aria-label={`Attitude: roll ${roll.toFixed(1)}° pitch ${pitch.toFixed(1)}°`}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={center} cy={center} r={radius} />
        </clipPath>
      </defs>

      {/* ── Rotating sky / ground ── */}
      <g clipPath={`url(#${clipId})`}>
        <g transform={`rotate(${roll}, ${center}, ${center})`}>
          {/* Sky */}
          <rect x={0} y={0} width={size} height={center + pitchPx} fill="#07192e" />
          {/* Ground */}
          <rect x={0} y={center + pitchPx} width={size} height={size} fill="#1a0d04" />
          {/* Horizon */}
          <line
            x1={0} y1={center + pitchPx}
            x2={size} y2={center + pitchPx}
            stroke="#00FF41" strokeWidth={1}
          />
          {/* Pitch ladder */}
          {PITCH_LINES.map((deg) => {
            const y = center + pitchPx - deg * PITCH_PIXELS_PER_DEGREE;
            const half = Math.abs(deg) === PITCH_LINE_STEP ? PITCH_LINE_MINOR_HALF : PITCH_LINE_MAJOR_HALF;
            return (
              <g key={deg}>
                <line
                  x1={center - half} y1={y}
                  x2={center + half} y2={y}
                  stroke="#00FF41" strokeWidth={0.6} strokeOpacity={0.55}
                />
                <text
                  x={center + half + 3} y={y + 3}
                  fontSize={6} fill="#00FF41" fillOpacity={0.5}
                >
                  {Math.abs(deg)}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Fixed crosshair (not rotated) ── */}
        <line
          x1={center - CROSSHAIR_ARM_OUTER} y1={center}
          x2={center - CROSSHAIR_ARM_INNER} y2={center}
          stroke="#00FF41" strokeWidth={2}
        />
        <line
          x1={center + CROSSHAIR_ARM_INNER} y1={center}
          x2={center + CROSSHAIR_ARM_OUTER} y2={center}
          stroke="#00FF41" strokeWidth={2}
        />
        <circle cx={center} cy={center} r={2} fill="#00FF41" />
      </g>

      {/* ── Roll arc and tick marks (outside clip) ── */}
      {ROLL_TICK_ANGLES.map((angle) => {
        const isMajor  = angle % 30 === 0 || angle === 0;
        const rad      = (angle - 90) * (Math.PI / 180);
        const outerR   = radius * ROLL_TICK_OUTER_R;
        const innerR   = radius * (isMajor ? ROLL_TICK_INNER_MAJOR_R : ROLL_TICK_INNER_MINOR_R);
        const x1 = center + outerR * Math.cos(rad);
        const y1 = center + outerR * Math.sin(rad);
        const x2 = center + innerR * Math.cos(rad);
        const y2 = center + innerR * Math.sin(rad);
        return (
          <line
            key={angle}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#00FF41" strokeWidth={isMajor ? 1.2 : 0.7} strokeOpacity={0.5}
          />
        );
      })}

      {/* Roll pointer triangle (rotates with roll) */}
      <g transform={`rotate(${roll}, ${center}, ${center})`}>
        <polygon
          points={`
            ${center},${center - radius * ROLL_TICK_OUTER_R + 2}
            ${center - ROLL_TRIANGLE_SIZE},${center - radius * ROLL_TICK_OUTER_R + ROLL_TRIANGLE_SIZE * 2 + 2}
            ${center + ROLL_TRIANGLE_SIZE},${center - radius * ROLL_TICK_OUTER_R + ROLL_TRIANGLE_SIZE * 2 + 2}
          `}
          fill="#00FF41"
          opacity={0.85}
        />
      </g>

      {/* Border */}
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#1e2a3a" strokeWidth={2} />
    </svg>
  );
}
