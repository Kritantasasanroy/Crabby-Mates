export function CrabLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crabGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B6B" />
          <stop offset="100%" stopColor="#ff8a5b" />
        </linearGradient>
      </defs>
      {/* claws */}
      <path d="M10 28 q-6 -4 -2 -10 q4 -2 8 4" stroke="url(#crabGrad)" strokeWidth="3" fill="url(#crabGrad)" />
      <path d="M54 28 q6 -4 2 -10 q-4 -2 -8 4" stroke="url(#crabGrad)" strokeWidth="3" fill="url(#crabGrad)" />
      {/* body */}
      <ellipse cx="32" cy="36" rx="20" ry="14" fill="url(#crabGrad)" />
      {/* eyes */}
      <circle cx="26" cy="30" r="3" fill="#0D1117" />
      <circle cx="38" cy="30" r="3" fill="#0D1117" />
      <circle cx="27" cy="29" r="1" fill="#fff" />
      <circle cx="39" cy="29" r="1" fill="#fff" />
      {/* legs */}
      <path d="M14 42 l-6 6 M14 46 l-6 4 M50 42 l6 6 M50 46 l6 4" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
      {/* smile */}
      <path d="M27 40 q5 4 10 0" stroke="#0D1117" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}