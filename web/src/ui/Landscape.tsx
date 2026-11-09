// Original flat, grainy landscape illustration: a southern-Brazil family farm
// with an araucária pine, pasture hills, crop rows and a small farmhouse.
// Decorative only (aria-hidden). Colours come from the token palette.
import { useId } from "react";

export function Landscape({ height = 180, className }: { height?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 800 240" preserveAspectRatio="xMidYMax slice" width="100%" height={height} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4fd8f3" />
          <stop offset="1" stopColor="#22c9ec" />
        </linearGradient>
        <filter id={`grain${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <g>
        <rect width="800" height="240" fill={`url(#sky${id})`} />
        {/* soft cloud bands */}
        <path d="M0 52 C 140 30, 260 70, 420 46 S 700 30, 800 50 L800 0 L0 0Z" fill="#8ce6f8" opacity="0.55" />
        {/* far hills */}
        <path d="M0 150 C 120 112, 230 128, 340 118 S 560 96, 800 128 L800 240 L0 240Z" fill="#22a36c" />
        {/* farmhouse + cistern on the far hill */}
        <g transform="translate(560 98)">
          <rect x="0" y="10" width="44" height="18" fill="#3d3f99" />
          <path d="M-4 12 L22 0 L48 12Z" fill="#f26b2c" />
          <rect x="16" y="17" width="8" height="11" fill="#0b2f22" />
          <rect x="58" y="6" width="12" height="22" rx="6" fill="#5b5fc7" />
        </g>
        {/* mid pasture with crop rows */}
        <path d="M0 178 C 160 150, 330 160, 480 150 S 700 140, 800 160 L800 240 L0 240Z" fill="#0f8a57" />
        <g stroke="#0b6f47" strokeWidth="3" opacity="0.7">
          <path d="M470 160 L420 240" /><path d="M500 158 L470 240" /><path d="M530 156 L520 240" />
          <path d="M560 155 L570 240" /><path d="M590 154 L620 240" /><path d="M620 153 L670 240" />
        </g>
        {/* near field */}
        <path d="M0 212 C 200 192, 420 206, 800 196 L800 240 L0 240Z" fill="#0b6f47" />
        {/* araucária pine, the tree of the southern highlands */}
        <g fill="#071d16">
          <rect x="128" y="70" width="7" height="150" />
          <path d="M131 74 C 100 64, 70 70, 52 84 C 80 80, 108 82, 131 90 C 154 82, 182 80, 210 84 C 192 70, 162 64, 131 74Z" />
          <path d="M131 104 C 104 98, 82 104, 68 114 C 92 110, 112 112, 131 118 C 150 112, 170 110, 194 114 C 180 104, 158 98, 131 104Z" />
          <path d="M131 132 C 112 128, 96 132, 86 140 C 104 138, 118 140, 131 144 C 144 140, 158 138, 176 140 C 166 132, 150 128, 131 132Z" />
          <path d="M131 60 C 118 56, 106 60, 98 66 C 110 64, 122 66, 131 70 C 140 66, 152 64, 164 66 C 156 60, 144 56, 131 60Z" />
        </g>
        <g fill="#0b2f22">
          <rect x="226" y="148" width="4" height="60" />
          <path d="M228 150 C 214 146, 202 150, 194 156 C 206 155, 218 156, 228 160 C 238 156, 250 155, 262 156 C 254 150, 242 146, 228 150Z" />
        </g>
        {/* a small orange spark: the sun catching a roof */}
        <circle cx="740" cy="40" r="9" fill="#f7843f" />
      </g>
      <rect width="800" height="240" filter={`url(#grain${id})`} />
    </svg>
  );
}
