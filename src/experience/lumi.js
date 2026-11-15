// Lumi, the friendly lander who guides people through the app.
// Moods: happy, wow, think, worried. Animated with CSS (bob, blink, wave).

const MOUTHS = {
  happy: '<path class="l-mouth" d="M50 66 Q60 75 70 66"/>',
  wow: '<ellipse cx="60" cy="69" rx="5" ry="6" fill="#fff"/>',
  think: '<path class="l-mouth" d="M52 69 L68 67"/>',
  worried: '<path class="l-mouth" d="M51 72 Q60 64 69 72"/>',
};

export function lumiSvg(mood = 'happy', size = 120) {
  const mouth = MOUTHS[mood] || MOUTHS.happy;
  return `<svg class="lumi" data-mood="${mood}" width="${size}" height="${size}" viewBox="0 0 120 124" aria-hidden="true">
    <ellipse cx="60" cy="118" rx="34" ry="4.5" class="l-shadow"/>
    <g class="lumi-bob">
      <line x1="40" y1="88" x2="26" y2="112" class="l-leg"/>
      <line x1="80" y1="88" x2="94" y2="112" class="l-leg"/>
      <line x1="60" y1="92" x2="60" y2="112" class="l-leg"/>
      <g class="lumi-panel">
        <line x1="36" y1="42" x2="22" y2="22" class="l-leg"/>
        <rect x="2" y="6" width="36" height="20" rx="4" class="l-panel" transform="rotate(-14 20 16)"/>
        <path d="M14 8 L16 26 M26 6 L28 24" class="l-panel-line" transform="rotate(-14 20 16)"/>
      </g>
      <line x1="86" y1="40" x2="96" y2="24" class="l-leg"/>
      <path d="M84 24 Q98 6 113 19 Z" class="l-dish"/>
      <rect x="26" y="34" width="68" height="58" rx="22" class="l-body"/>
      <rect x="34" y="44" width="52" height="36" rx="16" class="l-face"/>
      <g class="lumi-blink">
        <ellipse cx="50" cy="57" rx="5" ry="6.5" class="l-eye"/>
        <ellipse cx="70" cy="57" rx="5" ry="6.5" class="l-eye"/>
      </g>
      <circle cx="41" cy="70" r="3.5" class="l-cheek"/>
      <circle cx="79" cy="70" r="3.5" class="l-cheek"/>
      ${mouth}
    </g>
  </svg>`;
}

/** Replace Lumi in `slot` with a new mood and play a small reaction. */
export function setLumi(slot, mood = 'happy', reaction = 'hop', size = 120) {
  if (!slot) return;
  slot.innerHTML = lumiSvg(mood, size);
  const svg = slot.querySelector('.lumi');
  if (!svg || !reaction) return;
  requestAnimationFrame(() => {
    svg.classList.add(reaction === 'cheer' ? 'is-cheer' : 'is-hop');
  });
}
