import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

type IslandTheme = 'snake' | 'apple' | 'tree' | 'hut' | 'palm' | 'rocks';

interface LessonIslandProps {
  letter: string;
  phonics: string;
  stars: number;
  completed: boolean;
  locked: boolean;
  theme: IslandTheme;
  lessonNumber?: number;
  current?: boolean;
  preserveLetterCase?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onFocus?: () => void;
  onTouchStart?: () => void;
}

function PalmTree({ x, y, scale = 1, muted = false }: { x: number; y: number; scale?: number; muted?: boolean }) {
  const leafA = muted ? '#7F8991' : '#1FAE43';
  const leafB = muted ? '#9AA2A9' : '#35CD58';
  const trunk = muted ? '#7E7470' : '#8C5528';

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 73 C9 49 12 24 7 0" stroke={trunk} strokeWidth="13" strokeLinecap="round" />
      <path d="M2 70 C14 48 15 24 11 2" stroke={muted ? '#9A9290' : '#BF7B35'} strokeWidth="4" strokeLinecap="round" />
      <path d="M8 1 C-35 -9 -58 11 -69 38 C-38 28 -12 20 8 9Z" fill={leafA} stroke={muted ? '#6E777E' : '#0B7C31'} strokeWidth="3" />
      <path d="M9 1 C34 -27 71 -24 92 -4 C55 -3 29 8 11 13Z" fill={leafB} stroke={muted ? '#6E777E' : '#12833A'} strokeWidth="3" />
      <path d="M9 5 C42 7 62 30 66 56 C38 39 24 24 9 13Z" fill={leafA} stroke={muted ? '#6E777E' : '#0B7C31'} strokeWidth="3" />
      <path d="M5 2 C-7 -27 -38 -34 -61 -26 C-31 -14 -11 -7 5 10Z" fill={leafB} stroke={muted ? '#6E777E' : '#12833A'} strokeWidth="3" />
      <circle cx="6" cy="3" r="8" fill={muted ? '#6D6765' : '#71431F'} />
    </g>
  );
}

function Bush({ x, y, scale = 1, muted = false }: { x: number; y: number; scale?: number; muted?: boolean }) {
  const fill = muted ? '#838C93' : '#53BE38';
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="0" cy="9" r="14" fill={fill} stroke={muted ? '#6C747B' : '#2E982F'} strokeWidth="3" />
      <circle cx="17" cy="3" r="17" fill={muted ? '#929AA1' : '#6BD143'} stroke={muted ? '#6C747B' : '#2E982F'} strokeWidth="3" />
      <circle cx="35" cy="12" r="13" fill={fill} stroke={muted ? '#6C747B' : '#2E982F'} strokeWidth="3" />
    </g>
  );
}

function Rock({ x, y, scale = 1, muted = false }: { x: number; y: number; scale?: number; muted?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M3 20 C5 6 18 -3 31 3 C43 8 49 21 38 31 H12 C6 30 2 26 3 20Z" fill={muted ? '#8A929A' : '#BCA66B'} stroke={muted ? '#69717A' : '#83734E'} strokeWidth="4" />
      <path d="M14 9 C19 4 27 4 33 10" fill="none" stroke={muted ? '#A7AEB5' : '#D6C489'} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
    </g>
  );
}

function MainDecoration({ theme, locked }: { theme: IslandTheme; locked: boolean }) {
  if (theme === 'snake') {
    return (
      <g>
        <Bush x={79} y={122} scale={1.05} muted={locked} />
        <path d="M156 167 C181 137 204 178 227 151 C242 134 258 150 249 171 C238 199 195 195 177 177" fill="none" stroke={locked ? '#7E8990' : '#2FAA45'} strokeWidth="15" strokeLinecap="round" />
        <circle cx="250" cy="161" r="19" fill={locked ? '#96A0A7' : '#51D35F'} stroke={locked ? '#6C747B' : '#168633'} strokeWidth="5" />
        <circle cx="255" cy="154" r="4" fill="#163020" />
        <path d="M262 163 L279 158" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }

  if (theme === 'apple') {
    return (
      <g>
        <path d="M103 189 V96" stroke={locked ? '#77706E' : '#7B4B23'} strokeWidth="20" strokeLinecap="round" />
        <circle cx="78" cy="105" r="31" fill={locked ? '#838C93' : '#56C641'} stroke={locked ? '#687078' : '#2D9034'} strokeWidth="5" />
        <circle cx="116" cy="88" r="38" fill={locked ? '#929AA1' : '#67D648'} stroke={locked ? '#687078' : '#2D9034'} strokeWidth="5" />
        <circle cx="151" cy="118" r="31" fill={locked ? '#838C93' : '#48B83B'} stroke={locked ? '#687078' : '#2D9034'} strokeWidth="5" />
        <path d="M85 139 C88 107 114 90 143 96 C171 89 197 113 193 147 C190 185 164 204 141 199 C115 207 85 183 85 139Z" fill={locked ? '#9A9FA6' : '#DD392E'} stroke={locked ? '#6F7680' : '#9C231C'} strokeWidth="6" />
        <path d="M143 96 C149 76 160 66 181 63" stroke={locked ? '#747B82' : '#74451F'} strokeWidth="8" strokeLinecap="round" />
        <path d="M167 67 C185 63 201 69 210 84 C189 86 176 79 167 67Z" fill={locked ? '#A3AAB1' : '#43B84D'} stroke={locked ? '#737B84' : '#218339'} strokeWidth="3" />
        <circle cx="117" cy="124" r="14" fill="#F46A5C" opacity={locked ? 0.2 : 0.8} />
      </g>
    );
  }

  if (theme === 'hut') {
    return (
      <g>
        <PalmTree x={89} y={105} scale={0.78} muted={locked} />
        <path d="M135 163 H205 V211 H135Z" fill={locked ? '#959AA2' : '#C47832'} stroke={locked ? '#686F78' : '#835023'} strokeWidth="5" />
        <path d="M120 166 L170 119 L219 166Z" fill={locked ? '#868E97' : '#F08A35'} stroke={locked ? '#686F78' : '#8E4A1B'} strokeWidth="6" />
        <path d="M161 178 H181 V211 H161Z" fill={locked ? '#696F77' : '#6D4122'} />
        <path d="M141 173 H157 V190 H141Z" fill={locked ? '#C1C6CA' : '#FFE6A5'} stroke={locked ? '#686F78' : '#835023'} strokeWidth="3" />
      </g>
    );
  }

  if (theme === 'tree') {
    return (
      <g>
        <path d="M119 207 V112" stroke={locked ? '#77706E' : '#865126'} strokeWidth="21" strokeLinecap="round" />
        <circle cx="83" cy="123" r="35" fill={locked ? '#838C93' : '#54C848'} stroke={locked ? '#687078' : '#2D9034'} strokeWidth="5" />
        <circle cx="124" cy="97" r="43" fill={locked ? '#929AA1' : '#6AD94B'} stroke={locked ? '#687078' : '#2D9034'} strokeWidth="5" />
        <circle cx="162" cy="137" r="35" fill={locked ? '#838C93' : '#47B941'} stroke={locked ? '#687078' : '#2D9034'} strokeWidth="5" />
        <circle cx="112" cy="148" r="42" fill={locked ? '#8B949B' : '#45B53E'} stroke={locked ? '#687078' : '#2D9034'} strokeWidth="5" />
      </g>
    );
  }

  return (
    <g>
      <PalmTree x={104} y={110} scale={0.84} muted={locked} />
      <Rock x={187} y={175} scale={0.72} muted={locked} />
      <Bush x={137} y={163} scale={0.75} muted={locked} />
    </g>
  );
}

function StarRow({ stars, locked }: { stars: number; locked: boolean }) {
  return (
    <div className={`absolute left-1/2 top-[218px] z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-4 py-2 shadow-xl ring-1 ring-white/80 ${locked ? 'bg-slate-100/90' : 'bg-white/95'}`}>
      {[0, 1, 2].map((index) => (
        <Star
          key={index}
          size={27}
          strokeWidth={2.2}
          className={index < stars && !locked ? 'fill-amber-400 text-amber-500 drop-shadow-sm' : 'fill-slate-300 text-slate-400'}
        />
      ))}
    </div>
  );
}

export default function LessonIsland({
  letter,
  phonics,
  stars,
  completed,
  locked,
  theme,
  lessonNumber = 1,
  current = false,
  preserveLetterCase = false,
  onClick,
  onMouseEnter,
  onFocus,
  onTouchStart,
}: LessonIslandProps) {
  const islandState = locked ? 'locked' : completed ? 'completed' : current ? 'current' : 'open';
  const flagFill = locked ? '#7D858E' : completed ? '#176DD3' : '#1C78DE';
  const flagStroke = locked ? '#565E68' : '#0A4DAA';
  const sandFill = locked ? '#A7ACB2' : '#F7D66D';
  const sandStroke = locked ? '#7A818A' : '#DFAE50';
  const grassFill = locked ? '#878F98' : '#57C94C';
  const grassStroke = locked ? '#707982' : '#339A38';
  const lowerSand = locked ? '#8E969F' : '#DDA852';
  const water = locked ? '#A9D9E5' : '#C7F8FF';

  return (
    <motion.button
      type="button"
      aria-label={`${locked ? 'Locked' : 'Start'} lesson ${lessonNumber}: ${letter}`}
      disabled={locked}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      onTouchStart={onTouchStart}
      initial={{ opacity: 0, scale: 0.82, y: 22 }}
      animate={{
        opacity: locked ? 0.76 : 1,
        scale: current ? [1, 1.035, 1] : 1,
        y: current ? [0, -8, 0] : [0, -5, 0],
      }}
      transition={{
        opacity: { duration: 0.3 },
        scale: { duration: 1.75, repeat: current ? Infinity : 0, ease: 'easeInOut' },
        y: { duration: current ? 1.75 : 3.6, repeat: Infinity, ease: 'easeInOut' },
      }}
      whileHover={!locked ? { scale: 1.025 } : undefined}
      whileTap={!locked ? { scale: 0.96 } : undefined}
      className={`lesson-island ${islandState} relative h-[270px] w-[320px] touch-manipulation border-0 bg-transparent p-0 text-left outline-none`}
    >
      {current && <span className="absolute left-1/2 top-[52px] h-40 w-64 -translate-x-1/2 rounded-full bg-yellow-200/55 blur-3xl" />}

      <span className="absolute left-3 top-9 z-30 grid h-13 w-13 place-items-center rounded-full border-[3px] border-white bg-green-500 text-3xl font-black text-white shadow-xl">
        {lessonNumber}
      </span>

      <span className="absolute right-9 top-5 z-30 rounded-2xl border-[5px] border-white bg-[#FF654F] px-3 py-1 text-xl font-black leading-none text-white shadow-xl">
        {phonics}
      </span>

      <svg viewBox="0 0 320 248" className="relative z-10 h-[248px] w-[320px] overflow-visible drop-shadow-2xl" role="img" aria-hidden="true">
        <defs>
          <radialGradient id={`waterGlow-${lessonNumber}`} cx="50%" cy="56%" r="55%">
            <stop offset="0%" stopColor="#E7FFFF" stopOpacity="0.95" />
            <stop offset="55%" stopColor={water} stopOpacity="0.75" />
            <stop offset="100%" stopColor="#36C4E8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`sandDepth-${lessonNumber}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={sandFill} />
            <stop offset="72%" stopColor={lowerSand} />
          </linearGradient>
          <filter id={`islandShadow-${lessonNumber}`} x="-25%" y="-20%" width="150%" height="155%">
            <feDropShadow dx="0" dy="13" stdDeviation="7" floodColor="#056D9E" floodOpacity="0.34" />
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#064C68" floodOpacity="0.22" />
          </filter>
        </defs>

        <g filter={`url(#islandShadow-${lessonNumber})`}>
          <ellipse cx="157" cy="202" rx="133" ry="38" fill={`url(#waterGlow-${lessonNumber})`} />
          <path d="M33 194 C61 215 101 221 153 220 C211 221 263 207 292 181" fill="none" stroke="#EFFFFF" strokeWidth="8" strokeLinecap="round" opacity={locked ? 0.32 : 0.78} />
          <path d="M37 171 C45 95 99 59 167 64 C235 68 285 109 292 169 C280 215 229 238 155 237 C87 236 42 214 37 171Z" fill={`url(#sandDepth-${lessonNumber})`} stroke={sandStroke} strokeWidth="7" />
          <path d="M55 160 C78 102 117 86 171 90 C226 94 263 121 275 166 C254 198 210 213 155 212 C103 211 69 194 55 160Z" fill={grassFill} stroke={grassStroke} strokeWidth="7" />
          <path d="M44 194 C92 215 211 215 285 176 C279 216 225 238 155 237 C90 236 53 221 44 194Z" fill={lowerSand} opacity="0.93" />
          <path d="M71 181 C102 197 216 198 257 171" fill="none" stroke="#FFE68A" strokeWidth="6" strokeLinecap="round" opacity={locked ? 0.16 : 0.55} />

          <MainDecoration theme={theme} locked={locked} />
          <PalmTree x={238} y={100} scale={0.74} muted={locked} />
          <Rock x={48} y={180} scale={0.78} muted={locked} />
          <Rock x={250} y={196} scale={0.55} muted={locked} />
          <Bush x={194} y={157} scale={0.66} muted={locked} />

          <path d="M132 193 V53" stroke={locked ? '#6D747D' : '#6C5337'} strokeWidth="11" strokeLinecap="round" />
          <path d="M137 58 C184 36 226 55 268 47 V134 C223 149 184 113 137 139Z" fill={flagFill} stroke={flagStroke} strokeWidth="7" className="island-flag" />
          <path d="M137 58 C180 46 215 58 257 52 V69 C212 73 183 60 137 74Z" fill="#FFFFFF" opacity={locked ? 0.1 : 0.2} />
          <circle cx="132" cy="43" r="14" fill={locked ? '#A3A9B0' : '#F7C95B'} stroke={locked ? '#6D747D' : '#7C5721'} strokeWidth="5" />

          {locked ? (
            <g transform="translate(205 78)">
              <rect x="0" y="32" width="48" height="39" rx="8" fill="#F2F4F7" stroke="#68717B" strokeWidth="7" />
              <path d="M11 32 V18 C11 4 37 4 37 18 V32" fill="none" stroke="#68717B" strokeWidth="8" strokeLinecap="round" />
              <circle cx="24" cy="50" r="5" fill="#68717B" />
            </g>
          ) : (
            <text x="205" y="104" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={letter.length > 1 ? 62 : 82} fontWeight="900" fontFamily="'Comic Sans MS', 'Comic Sans', cursive">
              {preserveLetterCase ? letter : letter.toLowerCase()}
            </text>
          )}
        </g>
      </svg>

      <StarRow stars={stars} locked={locked} />
    </motion.button>
  );
}
