// components/icons.js

function Svg({ filled = false, children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : 2}
      strokeLinecap={filled ? undefined : 'round'}
      strokeLinejoin={filled ? undefined : 'round'}
      {...props}
    >
      {children}
    </svg>
  );
}

const icons = {
  sparkles: (
    <Svg>
      <path d="M12 3l1.7 3.9 3.9 1.7-3.9 1.7L12 14.2l-1.7-3.9-3.9-1.7 3.9-1.7L12 3Z" />
      <path d="M19 13l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13Z" />
      <path d="M5 15l.7 1.6 1.6.7-1.6.7L5 19.6 4.3 18l-1.6-.7 1.6-.7L5 15Z" />
    </Svg>
  ),

  download: (
    <Svg>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  ),

  qr: (
    <Svg>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20.5 14v.01" />
      <path d="M14 20.5v.01" />
      <path d="M20.5 20.5v.01" />
    </Svg>
  ),

  sticker: (
    <Svg>
      <path d="M4 6a2 2 0 0 1 2-2h7l7 7v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" />
      <path d="M13 4v7h7" />
    </Svg>
  ),

  image: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-4.5-4.5L7 20" />
    </Svg>
  ),

  lock: (
    <Svg>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path d="M12 15v2" />
    </Svg>
  ),

  json: (
    <Svg>
      <path d="M7 3c-1.5 0-2 1-2 2v3c0 1-.5 1.5-1.5 2C4.5 10.5 5 11 5 12v3c0 1 .5 2 2 2" />
      <path d="M17 3c1.5 0 2 1 2 2v3c0 1 .5 1.5 1.5 2-1 .5-1.5 1-1.5 2v3c0 1-.5 2-2 2" />
    </Svg>
  ),

  case: (
    <Svg>
      <path d="M4 7V5h16v2" />
      <path d="M12 5v14" />
      <path d="M8 19h8" />
    </Svg>
  ),

  palette: (
    <Svg>
      <path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.3 0-1.1.9-2 2-2h2.5A4.5 4.5 0 0 0 22 10C22 6 17.5 3 12 3Z" />
      <circle cx="7.5" cy="11.5" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </Svg>
  ),

  poster: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h10" />
      <path d="M7 12h7" />
      <path d="M7 16h4" />
    </Svg>
  ),

  flame: (
    <Svg>
      <path d="M12 3c2 4 6 6 6 10a6 6 0 0 1-12 0c0-2 .5-3.5 1.5-5C8.5 9.5 11 8 12 3Z" />
      <path d="M12 17a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1.5-2.5-2.5-4-1 1.5-2.5 2.5-2.5 4A2.5 2.5 0 0 0 12 17Z" />
    </Svg>
  ),

  gamepad: (
    <Svg>
      <path d="M6.5 7h11A3.5 3.5 0 0 1 21 10.5v3A3.5 3.5 0 0 1 17.5 17c-1 0-1.9-.5-2.5-1.2L14 14.5h-4l-1 1.3c-.6.7-1.5 1.2-2.5 1.2A3.5 3.5 0 0 1 3 13.5v-3A3.5 3.5 0 0 1 6.5 7Z" />
      <path d="M8 10.5v3" />
      <path d="M6.5 12h3" />
      <path d="M15.5 11.5h.01" />
      <path d="M17.5 13.5h.01" />
    </Svg>
  ),

  search: (
    <Svg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),

  arrowLeft: (
    <Svg>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Svg>
  ),

  copy: (
    <Svg>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  ),

  clipboard: (
    <Svg>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </Svg>
  ),

  trophy: (
    <Svg>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    </Svg>
  ),

  volumeOn: (
    <Svg>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </Svg>
  ),

  volumeOff: (
    <Svg>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="m16 9 5 5" />
      <path d="m21 9-5 5" />
    </Svg>
  ),

  refresh: (
    <Svg>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </Svg>
  ),

  link: (
    <Svg>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.43" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07l1.32-1.33" />
    </Svg>
  ),

  check: (
    <Svg>
      <path d="m5 12 4 4L19 6" />
    </Svg>
  ),

  close: (
    <Svg>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Svg>
  ),

  warning: (
    <Svg>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Svg>
  ),

  info: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M12 11v5" />
    </Svg>
  ),

  quiz: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.5c0 1.5-2.4 2-2.4 3.5" />
      <path d="M12 17h.01" />
    </Svg>
  ),

  logic: (
    <Svg>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M10 6.5h4a2 2 0 0 1 2 2V14" />
      <path d="M6.5 10v4a2 2 0 0 0 2 2H14" />
    </Svg>
  ),

  typing: (
    <Svg>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01" />
      <path d="M10 10h.01" />
      <path d="M14 10h.01" />
      <path d="M18 10h.01" />
      <path d="M7 14h10" />
    </Svg>
  ),

  math: (
    <Svg>
      <path d="M8 6v6" />
      <path d="M5 9h6" />
      <path d="M15 9h4" />
      <path d="M15 15h4" />
      <path d="M8 15h.01" />
    </Svg>
  ),

  memory: (
    <Svg>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </Svg>
  ),

  emoji: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14a4 4 0 0 0 7 0" />
      <path d="M9 9.5h.01" />
      <path d="M15 9.5h.01" />
    </Svg>
  ),

  word: (
    <Svg>
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h7" />
    </Svg>
  ),

  angka: (
    <Svg>
      <path d="M5 9h14" />
      <path d="M5 15h14" />
      <path d="M9 4v16" />
      <path d="M15 4v16" />
    </Svg>
  ),

  youtube: (
    <Svg filled fillRule="evenodd" clipRule="evenodd">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </Svg>
  ),

  tiktok: (
    <Svg filled fillRule="evenodd" clipRule="evenodd">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </Svg>
  ),

  instagram: (
    <Svg filled fillRule="evenodd" clipRule="evenodd">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
    </Svg>
  ),

  x: (
    <Svg filled fillRule="evenodd" clipRule="evenodd">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </Svg>
  ),

  facebook: (
    <Svg filled fillRule="evenodd" clipRule="evenodd">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </Svg>
  ),

  spotify: (
    <Svg filled fillRule="evenodd" clipRule="evenodd">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.56.3z" />
    </Svg>
  ),

  pinterest: (
    <Svg filled fillRule="evenodd" clipRule="evenodd">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </Svg>
  ),

  soundcloud: (
    <Svg>
      <path d="M6.5 16.5a4 4 0 0 1-.7-7.94A5.5 5.5 0 0 1 16.5 7.6a3.5 3.5 0 0 1 1 8.9H6.5Z" />
      <path d="M8 12v4" />
      <path d="M11 10v6" />
      <path d="M14 11v5" />
      <path d="M17 12v4" />
    </Svg>
  ),

  reddit: (
    <Svg>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 6V4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <path d="M8.5 15.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5" />
      <path d="M3.5 10C2.7 10 2 9.3 2 8.5S2.7 7 3.5 7 5 7.7 5 8.5" />
      <path d="M20.5 10c.8 0 1.5-.7 1.5-1.5S21.3 7 20.5 7 19 7.7 19 8.5" />
    </Svg>
  ),
};

// alias biar gampang dipake dari slug / platform
icons.media = icons.download;
icons.twitter = icons.x;
icons['qr-code'] = icons.qr;
icons['sticker-maker'] = icons.sticker;
icons['image-compressor'] = icons.image;
icons.password = icons.lock;
icons['json-formatter'] = icons.json;
icons['text-case'] = icons.case;
icons['color-picker'] = icons.palette;
icons['text-to-image'] = icons.poster;
icons.roasting = icons.flame;
icons.games = icons.gamepad;

export const iconNames = Object.keys(icons);

const toolIconMap = {
  downloader: 'download',
  'qr-code': 'qr',
  'sticker-maker': 'sticker',
  'image-compressor': 'image',
  password: 'lock',
  'json-formatter': 'json',
  'text-case': 'case',
  'color-picker': 'palette',
  'text-to-image': 'poster',
  roasting: 'flame',
  games: 'gamepad',
};

const platformIconMap = {
  youtube: 'youtube',
  tiktok: 'tiktok',
  instagram: 'instagram',
  facebook: 'facebook',
  twitter: 'x',
  x: 'x',
  pinterest: 'pinterest',
  spotify: 'spotify',
  soundcloud: 'soundcloud',
  reddit: 'reddit',
  generic: 'link',
};

export function getToolIconName(tool) {
  if (!tool) return 'sparkles';

  if (tool.icon && icons[tool.icon]) {
    return tool.icon;
  }

  if (tool.slug && toolIconMap[tool.slug]) {
    return toolIconMap[tool.slug];
  }

  if (tool.slug && icons[tool.slug]) {
    return tool.slug;
  }

  return 'sparkles';
}

export function getPlatformIconName(platform) {
  const key = String(platform || '').toLowerCase();
  return platformIconMap[key] || 'link';
}

export function Icon({ name = 'sparkles', size = 20, className = '', style = {} }) {
  const icon = icons[name] || icons.sparkles;

  return (
    <span
      className={['nv-icon', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 0,
        color: 'currentColor',
        ...style,
      }}
    >
      {icon}
    </span>
  );
}

export function PlatformIcon({ platform = 'generic', size = 18, className = '' }) {
  return <Icon name={getPlatformIconName(platform)} size={size} className={className} />;
}

export default Icon;

// ===== icon game tambahan =====
icons.puzzle = (
  <Svg>
    <path d="M10 3.5a1.5 1.5 0 0 1 3 0V5h3a2 2 0 0 1 2 2v3h1.5a1.5 1.5 0 0 1 0 3H18v3a2 2 0 0 1-2 2h-3v1.5a1.5 1.5 0 0 1-3 0V18H7a2 2 0 0 1-2-2v-3H3.5a1.5 1.5 0 0 1 0-3H5V7a2 2 0 0 1 2-2h3V3.5Z" />
  </Svg>
);

icons.flask = (
  <Svg>
    <path d="M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3" />
    <path d="M8.5 3h7" />
    <path d="M7 15h10" />
  </Svg>
);

icons.music = (
  <Svg>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </Svg>
);

icons.user = (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);

icons.bulb = (
  <Svg>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6V17h4v-.5c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3Z" />
  </Svg>
);

icons.moon = (
  <Svg>
    <path d="M20 12.5A8 8 0 1 1 11.5 4a6.5 6.5 0 0 0 8.5 8.5Z" />
  </Svg>
);

iconNames.push('puzzle', 'flask', 'music', 'user', 'bulb', 'moon');

icons.volumeOn = (
  <Svg>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </Svg>
);

icons.volumeOff = (
  <Svg>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </Svg>
);

iconNames.push('volumeOn', 'volumeOff');
