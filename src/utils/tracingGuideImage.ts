const SVG_SIZE = 400;
const GUIDE_FONT_FAMILY = "'Comic Sans MS','Arial Rounded MT Bold','Trebuchet MS',Arial,sans-serif";

export interface TracingGuideSpec {
  text: string;
  fontSize: number;
  baseline: number;
  letterSpacing: number;
  fontFamily: string;
}

export function getTracingGuideImage(displayLetter: string) {
  const spec = getTracingGuideSpec(displayLetter);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${SVG_SIZE}" height="${SVG_SIZE}" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">
      <rect width="${SVG_SIZE}" height="${SVG_SIZE}" fill="white"/>
      <text
        x="200"
        y="${spec.baseline}"
        text-anchor="middle"
        font-family="${GUIDE_FONT_FAMILY}"
        font-size="${spec.fontSize}"
        font-weight="700"
        letter-spacing="${spec.letterSpacing}"
        fill="#dbeafe"
      >${escapeSvgText(spec.text)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getTracingGuideSpec(displayLetter: string): TracingGuideSpec {
  const text = normalizeDisplayText(displayLetter);
  return {
    text,
    fontSize: getFontSize(text),
    baseline: getBaseline(text),
    letterSpacing: text.length > 2 ? 2 : 0,
    fontFamily: GUIDE_FONT_FAMILY,
  };
}

function normalizeDisplayText(value: string) {
  const raw = String(value || 'a').trim();
  if (raw.includes(' ')) return raw.replace(/\s+/g, '');
  return raw || 'a';
}

function getFontSize(text: string) {
  if (text.length >= 4) return 118;
  if (text.length === 3) return 145;
  if (text.length === 2) return 210;
  return 285;
}

function getBaseline(text: string) {
  if (text.length >= 4) return 242;
  if (text.length === 3) return 250;
  if (text.length === 2) return 264;
  return 286;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
