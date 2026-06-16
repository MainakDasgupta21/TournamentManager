/**
 * Shareable match result card (Module 9). Builds a self-contained 1200×630 SVG
 * (no external image refs, so it converts to PNG without tainting the canvas)
 * and a helper to turn that SVG into a downloadable PNG blob.
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Truncate long names so they fit the card. */
const clip = (s, n = 22) => {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
};

export function buildResultCardSvg({
  tournamentName = 'Tournament',
  roundName = '',
  teamAName = 'Team A',
  teamBName = 'Team B',
  scoreA = '',
  scoreB = '',
  outcome = '',
  accent = '#6366f1',
}) {
  const W = 1200;
  const H = 630;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0e1a"/>
      <stop offset="100%" stop-color="#11182e"/>
    </linearGradient>
    <radialGradient id="glow" cx="18%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${esc(accent)}" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="${esc(accent)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${esc(accent)}"/>

  <text x="60" y="92" fill="#94a3b8" font-family="Outfit, system-ui, sans-serif" font-size="26" font-weight="600" letter-spacing="2">${esc(clip(tournamentName.toUpperCase(), 40))}</text>
  <text x="60" y="130" fill="#64748b" font-family="Outfit, system-ui, sans-serif" font-size="22">${esc(clip(roundName, 48))}</text>

  <text x="60" y="290" fill="#f8fafc" font-family="Outfit, system-ui, sans-serif" font-size="64" font-weight="700">${esc(clip(teamAName))}</text>
  <text x="1140" y="290" text-anchor="end" fill="#f8fafc" font-family="Outfit, system-ui, sans-serif" font-size="64" font-weight="700">${esc(scoreA)}</text>

  <text x="60" y="400" fill="#f8fafc" font-family="Outfit, system-ui, sans-serif" font-size="64" font-weight="700">${esc(clip(teamBName))}</text>
  <text x="1140" y="400" text-anchor="end" fill="#f8fafc" font-family="Outfit, system-ui, sans-serif" font-size="64" font-weight="700">${esc(scoreB)}</text>

  <line x1="60" y1="330" x2="1140" y2="330" stroke="#1e293b" stroke-width="2"/>

  <rect x="60" y="470" rx="14" width="1080" height="80" fill="${esc(accent)}" fill-opacity="0.14"/>
  <text x="600" y="522" text-anchor="middle" fill="#f8fafc" font-family="Outfit, system-ui, sans-serif" font-size="34" font-weight="600">${esc(clip(outcome, 60))}</text>

  <text x="60" y="600" fill="#475569" font-family="Outfit, system-ui, sans-serif" font-size="22" font-weight="600" letter-spacing="3">TOURNEYOPS</text>
</svg>`;
}

/** Convert an SVG string to a PNG Blob at the given pixel size. */
export function svgToPngBlob(svg, width = 1200, height = 630) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
    };
    img.onerror = () => reject(new Error('SVG render failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Download a Blob with a given filename. */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
