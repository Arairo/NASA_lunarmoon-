// Lumi the Lunar Lander Mascot SVG generator.

export function mascotSvg(mood = 'happy', size = 84) {
  const mouth =
    mood === 'happy'
      ? '<path d="M52 66 Q60 74 68 66" class="m-line"/>'
      : mood === 'worried'
      ? '<path d="M52 71 Q60 64 68 71" class="m-line"/>'
      : '<path d="M53 68 L67 68" class="m-line"/>';

  return `<svg class="mascot" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
    <ellipse cx="60" cy="112" rx="40" ry="5" class="m-shadow"/>
    <line x1="38" y1="82" x2="22" y2="106" class="m-leg"/><line x1="82" y1="82" x2="98" y2="106" class="m-leg"/>
    <line x1="60" y1="86" x2="60" y2="106" class="m-leg"/>
    <ellipse cx="22" cy="107" rx="9" ry="3" class="m-foot"/><ellipse cx="98" cy="107" rx="9" ry="3" class="m-foot"/><ellipse cx="60" cy="107" rx="8" ry="3" class="m-foot"/>
    <line x1="32" y1="38" x2="22" y2="18" class="m-mast"/>
    <rect x="4" y="4" width="34" height="18" rx="2" class="m-panel" transform="rotate(-12 21 13)"/>
    <path d="M10 6 L12 22 M18 5 L20 21 M26 4 L28 20 M5 12 L37 6" class="m-grid" transform="rotate(-12 21 13)"/>
    <line x1="88" y1="38" x2="96" y2="22" class="m-mast"/>
    <path d="M86 22 Q97 8 110 18 Z" class="m-dish"/>
    <rect x="28" y="36" width="64" height="50" rx="14" class="m-body"/>
    <rect x="28" y="36" width="64" height="12" rx="6" class="m-band"/>
    <circle cx="48" cy="58" r="8" class="m-eye"/><circle cx="72" cy="58" r="8" class="m-eye"/>
    <circle cx="50" cy="59" r="3.6" class="m-pupil"/><circle cx="74" cy="59" r="3.6" class="m-pupil"/>
    ${mouth}
  </svg>`;
}
