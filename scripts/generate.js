const fs = require('fs');
const path = require('path');

const CONFIG = {
  username: 'NemalFdo',
  name: 'Nemal Fernando',
  role: 'Software Engineer • Full-Stack & Mobile Developer',
  location: 'Sri Lanka (UTC+05:30)',
  email: 'dinethnemal2002@gmail.com',
  linkedin: 'linkedin.com/in/nemal-fernando',
  github: 'github.com/NemalFdo',
};

const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;

const escapeXml = (unsafe) =>
  String(unsafe).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[c]));

async function fetchGitHubStats() {
  if (!TOKEN) {
    return null;
  }

  const query = `
    query($username: String!) {
      user(login: $username) {
        avatarUrl(size: 400)
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          totalCount
          nodes {
            stargazerCount
          }
        }
        followers {
          totalCount
        }
        pullRequests {
          totalCount
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { username: CONFIG.username } }),
    });

    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data.user;
  } catch (err) {
    console.warn('Live GraphQL fetch unavailable, using cached metrics fallback:', err.message);
    return null;
  }
}

/**
 * Fallback metrics parser so `node scripts/generate.js` works locally even without GH_PAT
 */
function loadFallbackMetrics() {
  const contribPath = path.join(__dirname, '..', 'assets', 'contributions.svg');
  const colorToCount = {
    '#161b22': 0,
    '#0e4429': 2,
    '#006d32': 4,
    '#26a641': 8,
    '#39d353': 14,
  };

  const weeks = [];
  if (fs.existsSync(contribPath)) {
    const svg = fs.readFileSync(contribPath, 'utf8');
    const rectRegex = /<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="11"[^>]*fill="(#[0-9a-fA-F]{6})"/g;
    const byX = new Map();
    let match;
    while ((match = rectRegex.exec(svg)) !== null) {
      const x = match[1];
      const fill = match[3].toLowerCase();
      if (!byX.has(x)) byX.set(x, []);
      if (byX.get(x).length < 7) {
        byX.get(x).push({
          contributionCount: colorToCount[fill] ?? 0,
          date: '2026-06-01',
        });
      }
    }
    for (const days of byX.values()) {
      weeks.push({ contributionDays: days });
    }
  }

  while (weeks.length < 52) {
    const wIdx = weeks.length;
    const days = Array.from({ length: 7 }, (_, dIdx) => ({
      contributionCount: (wIdx * 3 + dIdx * 5) % 7 === 0 ? 4 : 0,
      date: '2026-06-01',
    }));
    weeks.push({ contributionDays: days });
  }

  return {
    total: '717',
    currentStreak: 5,
    longestStreak: 6,
    activeDays: 181,
    maxDay: 30,
    avgActive: '4.0',
    repos: 18,
    stars: 14,
    followers: 12,
    prs: 28,
    weeks: weeks.slice(-52),
    monthlyTotals: [40, 30, 26, 102, 74, 86, 32, 53, 30, 26, 19, 7],
  };
}

// Converts an image (local scripts/avatar.png or GitHub avatarUrl) to crisp Braille/ASCII art
async function buildBraillePortrait(avatarUrl) {
  const customAsciiPath = path.join(__dirname, 'ascii.txt');
  if (fs.existsSync(customAsciiPath)) {
    const content = fs
      .readFileSync(customAsciiPath, 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/^\n+|\n+$/g, '');
    if (content.length > 50) return content;
  }

  if (!avatarUrl) {
    return '';
  }

  let Jimp;
  try {
    ({ Jimp } = require('jimp'));
  } catch {
    Jimp = require('jimp');
  }

  const localPhoto = path.join(__dirname, 'avatar.png');
  const source = fs.existsSync(localPhoto) ? localPhoto : avatarUrl;
  const img = await Jimp.read(source);

  const pxW = 88;
  const pxH = 112;
  img.cover({ w: pxW, h: pxH }).greyscale().contrast(0.35);

  const dotMap = [
    [0, 0, 0x01], [0, 1, 0x02], [0, 2, 0x04], [0, 3, 0x40],
    [1, 0, 0x08], [1, 1, 0x10], [1, 2, 0x20], [1, 3, 0x80],
  ];

  const lines = [];
  for (let y = 0; y < pxH; y += 4) {
    let line = '';
    for (let x = 0; x < pxW; x += 2) {
      let code = 0x2800;
      for (const [dx, dy, bit] of dotMap) {
        const idx = ((y + dy) * pxW + (x + dx)) * 4;
        const brightness = img.bitmap.data[idx];
        if (brightness > 110) code |= bit;
      }
      line += String.fromCharCode(code);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function calculateMetrics(userData) {
  const calendar = userData.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks;
  const allDays = weeks.flatMap((w) => w.contributionDays);

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let activeDays = 0;
  let maxDay = 0;

  const monthlyTotals = Array(12).fill(0);
  const currentYear = new Date().getFullYear();

  allDays.forEach((day) => {
    const count = day.contributionCount;
    if (count > 0) {
      activeDays++;
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
    if (count > maxDay) maxDay = count;

    const d = new Date(day.date);
    if (d.getFullYear() === currentYear) {
      monthlyTotals[d.getMonth()] += count;
    }
  });

  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i].contributionCount > 0) {
      currentStreak++;
    } else if (i === allDays.length - 1) {
      continue;
    } else {
      break;
    }
  }

  const avgActive = activeDays > 0 ? (calendar.totalContributions / activeDays).toFixed(1) : '0.0';
  const repos = userData.repositories?.totalCount ?? 18;
  const stars = (userData.repositories?.nodes || []).reduce(
    (acc, r) => acc + (r.stargazerCount || 0),
    0
  );
  const followers = userData.followers?.totalCount ?? 12;
  const prs = userData.pullRequests?.totalCount ?? 28;

  return {
    total: calendar.totalContributions.toLocaleString(),
    currentStreak,
    longestStreak,
    activeDays,
    maxDay,
    avgActive,
    repos,
    stars,
    followers,
    prs,
    weeks,
    monthlyTotals,
  };
}

function terminalHeader(title, width, statusLabel = 'LIVE', accentColor = '#39d353') {
  return `
    <rect x="0" y="0" width="${width}" height="32" rx="8" fill="#161b22"/>
    <rect x="0" y="16" width="${width}" height="16" fill="#161b22"/>
    <circle cx="18" cy="16" r="5" fill="#ff5f56"/>
    <circle cx="36" cy="16" r="5" fill="#ffbd2e"/>
    <circle cx="54" cy="16" r="5" fill="#27c93f">
      <animate attributeName="opacity" values="1;0.45;1" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <!-- Subtle Window Tab Pill -->
    <rect x="74" y="6" width="58" height="20" rx="4" fill="#0d1117" stroke="#30363d" stroke-width="0.8"/>
    <text x="103" y="19" fill="#58a6ff" font-family="monospace" font-size="9.5" font-weight="bold" text-anchor="middle">zsh 5.9</text>

    <text x="${width / 2}" y="20" fill="#8b949e" font-family="monospace" font-size="12" text-anchor="middle">${escapeXml(title)}<tspan class="cursor">_</tspan></text>

    <!-- Live Radar Status Indicator -->
    <rect x="${width - 78}" y="6" width="66" height="20" rx="10" fill="#0d1117" stroke="#30363d" stroke-width="0.8"/>
    <circle cx="${width - 64}" cy="16" r="3.2" fill="${accentColor}"/>
    <circle cx="${width - 64}" cy="16" r="3.2" fill="none" stroke="${accentColor}" stroke-width="1.2">
      <animate attributeName="r" values="3.2;7.8;3.2" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.9;0;0.9" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="${width - 54}" y="19.5" fill="${accentColor}" font-family="monospace" font-size="9.5" font-weight="bold">${escapeXml(statusLabel)}</text>
    <line x1="0" y1="32" x2="${width}" y2="32" stroke="#30363d" stroke-width="1"/>
  `;
}

/**
 * 1. Animated Cyber Command Center Hero Banner (assets/hero.svg)
 */
function generateHeroSVG(metrics) {
  const width = 840;
  const height = 230;

  const floatingTokens = [
    { x: 45, y: 185, text: '01101110', color: '#39d353', dur: '6s', delay: '0s' },
    { x: 155, y: 205, text: '&lt;React /&gt;', color: '#58a6ff', dur: '7s', delay: '1.2s' },
    { x: 280, y: 195, text: 'async () =&gt;', color: '#bc8cff', dur: '5.5s', delay: '0.5s' },
    { x: 540, y: 200, text: 'dotnet run', color: '#39d353', dur: '6.5s', delay: '1.8s' },
    { x: 670, y: 190, text: '{ status: 200 }', color: '#58a6ff', dur: '5.8s', delay: '0.8s' },
    { x: 765, y: 205, text: 'git push', color: '#d29922', dur: '6.2s', delay: '2.1s' },
  ]
    .map(
      (t) => `
      <text x="${t.x}" y="${t.y}" fill="${t.color}" font-family="monospace" font-size="10" opacity="0.25">
        ${t.text}
        <animate attributeName="y" values="${t.y};${t.y - 135}" dur="${t.dur}" begin="${t.delay}" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.35;0" dur="${t.dur}" begin="${t.delay}" repeatCount="indefinite"/>
      </text>`
    )
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="heroBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0d1117"/>
        <stop offset="50%" stop-color="#111823"/>
        <stop offset="100%" stop-color="#0d1117"/>
      </linearGradient>
      <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#39d353">
          <animate attributeName="stop-color" values="#39d353;#58a6ff;#bc8cff;#39d353" dur="6s" repeatCount="indefinite"/>
        </stop>
        <stop offset="50%" stop-color="#58a6ff">
          <animate attributeName="stop-color" values="#58a6ff;#bc8cff;#39d353;#58a6ff" dur="6s" repeatCount="indefinite"/>
        </stop>
        <stop offset="100%" stop-color="#7ee787">
          <animate attributeName="stop-color" values="#7ee787;#39d353;#58a6ff;#7ee787" dur="6s" repeatCount="indefinite"/>
        </stop>
      </linearGradient>
      <linearGradient id="waveGradA" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#39d353" stop-opacity="0.18"/>
        <stop offset="50%" stop-color="#58a6ff" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#bc8cff" stop-opacity="0.18"/>
      </linearGradient>
      <clipPath id="heroClip">
        <rect width="${width}" height="${height}" rx="8"/>
      </clipPath>
    </defs>

    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      @keyframes blink { 50% { opacity: 0; } }
    </style>

    <g clip-path="url(#heroClip)">
      <rect width="${width}" height="${height}" rx="8" fill="url(#heroBg)"/>

      <!-- Subtle Cyber Grid Background -->
      <g stroke="#21262d" stroke-width="0.7" opacity="0.55">
        <line x1="0" y1="68" x2="${width}" y2="68"/>
        <line x1="0" y1="108" x2="${width}" y2="108"/>
        <line x1="0" y1="148" x2="${width}" y2="148"/>
        <line x1="0" y1="188" x2="${width}" y2="188"/>
        <line x1="140" y1="32" x2="140" y2="${height}"/>
        <line x1="280" y1="32" x2="280" y2="${height}"/>
        <line x1="420" y1="32" x2="420" y2="${height}"/>
        <line x1="560" y1="32" x2="560" y2="${height}"/>
        <line x1="700" y1="32" x2="700" y2="${height}"/>
      </g>

      <!-- Floating Code & Binary Particles -->
      ${floatingTokens}

      <!-- Animated Bottom Cyber Waves -->
      <path fill="url(#waveGradA)">
        <animate attributeName="d" dur="7s" repeatCount="indefinite" values="
          M 0 192 Q 210 168 420 192 T 840 192 L 840 230 L 0 230 Z;
          M 0 192 Q 210 215 420 192 T 840 192 L 840 230 L 0 230 Z;
          M 0 192 Q 210 168 420 192 T 840 192 L 840 230 L 0 230 Z"/>
      </path>
      <path fill="url(#waveGradA)" opacity="0.6">
        <animate attributeName="d" dur="5s" repeatCount="indefinite" values="
          M 0 202 Q 210 222 420 202 T 840 202 L 840 230 L 0 230 Z;
          M 0 202 Q 210 178 420 202 T 840 202 L 840 230 L 0 230 Z;
          M 0 202 Q 210 222 420 202 T 840 202 L 840 230 L 0 230 Z"/>
      </path>

      <!-- Terminal Title Bar -->
      ${terminalHeader('nemalfdo@github ~ $ ./init-command-center.sh --fullscreen', width, 'ONLINE')}

      <!-- Left Animated Cyber Radar Core (cx=105, cy=128) -->
      <g transform="translate(105, 130)">
        <circle cx="0" cy="0" r="54" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
        <!-- Outer Rotating Dashed Ring -->
        <circle cx="0" cy="0" r="46" fill="none" stroke="#39d353" stroke-width="2" stroke-dasharray="22 10 8 10" opacity="0.85">
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="10s" repeatCount="indefinite"/>
        </circle>
        <!-- Middle Counter-Rotating Cyan Ring -->
        <circle cx="0" cy="0" r="35" fill="none" stroke="#58a6ff" stroke-width="1.6" stroke-dasharray="16 12" opacity="0.8">
          <animateTransform attributeName="transform" type="rotate" from="360 0 0" to="0 0 0" dur="7s" repeatCount="indefinite"/>
        </circle>
        <!-- Inner Pulsing Core -->
        <circle cx="0" cy="0" r="22" fill="#161b22" stroke="#bc8cff" stroke-width="1.2">
          <animate attributeName="r" values="20;24;20" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <text x="0" y="5" fill="#e6edf3" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">&lt;/&gt;</text>
      </g>

      <!-- Main Hero Text & HUD -->
      <text x="190" y="72" fill="#39d353" font-family="monospace" font-size="11.5" font-weight="bold">
        ▸ SYSTEM.IDENTITY // VERIFIED DEVELOPER PROFILE
      </text>

      <text x="190" y="112" fill="url(#titleGrad)" font-family="monospace" font-size="33" font-weight="bold" letter-spacing="1">
        NEMAL FERNANDO
      </text>

      <text x="190" y="138" fill="#e6edf3" font-family="monospace" font-size="13.5" font-weight="bold">
        Software Engineer  •  Full-Stack Developer  •  Mobile App Developer
      </text>

      <!-- Animated HUD Badges Row -->
      <g transform="translate(190, 154)">
        <rect x="0" y="0" width="142" height="24" rx="5" fill="#161b22" stroke="#39d353" stroke-width="1"/>
        <text x="71" y="15.5" fill="#39d353" font-family="monospace" font-size="10.5" font-weight="bold" text-anchor="middle">⚡ ${metrics.total} COMMITS/YR</text>

        <rect x="152" y="0" width="166" height="24" rx="5" fill="#161b22" stroke="#58a6ff" stroke-width="1"/>
        <text x="235" y="15.5" fill="#58a6ff" font-family="monospace" font-size="10.5" font-weight="bold" text-anchor="middle">🌐 REACT • NEXT • .NET</text>

        <rect x="328" y="0" width="154" height="24" rx="5" fill="#161b22" stroke="#bc8cff" stroke-width="1"/>
        <text x="405" y="15.5" fill="#bc8cff" font-family="monospace" font-size="10.5" font-weight="bold" text-anchor="middle">📱 MOBILE &amp; SYSTEMS</text>

        <rect x="492" y="0" width="120" height="24" rx="5" fill="#161b22" stroke="#d29922" stroke-width="1"/>
        <text x="552" y="15.5" fill="#d29922" font-family="monospace" font-size="10.5" font-weight="bold" text-anchor="middle">📍 SRI LANKA</text>
      </g>

      <!-- Bottom Command Prompt Line -->
      <text x="190" y="206" fill="#8b949e" font-family="monospace" font-size="11">
        <tspan fill="#39d353" font-weight="bold">nemalfdo@github</tspan>:<tspan fill="#58a6ff">~/portfolio</tspan>$ ./deploy-innovation.sh --watch --mode=autonomous<tspan class="cursor"> █</tspan>
      </text>
    </g>

    <rect width="${width}" height="${height}" rx="8" fill="none" stroke="#30363d" stroke-width="1.5"/>
  </svg>`;
}

/**
 * 2. Detailed 365-Day Contribution Matrix & Dual-Laser Radar (assets/contributions.svg)
 */
function generateContributionsSVG(metrics) {
  const width = 840;
  const height = 230;
  const cellSize = 11;
  const cellGap = 3.4;
  const startX = 48;
  const startY = 66;

  const getGreen = (count) => {
    if (count === 0) return '#161b22';
    if (count <= 2) return '#0e4429';
    if (count <= 5) return '#006d32';
    if (count <= 10) return '#26a641';
    return '#39d353';
  };

  // Month headers along top of heatmap
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabels = monthNames
    .map(
      (m, i) =>
        `<text x="${startX + Math.round(i * 4.35 * (cellSize + cellGap))}" y="56" fill="#6e7681" font-family="monospace" font-size="9.5">${m}</text>`
    )
    .join('');

  // Day-of-week labels along left of heatmap
  const dayLabels = [
    { label: 'Mon', row: 1 },
    { label: 'Wed', row: 3 },
    { label: 'Fri', row: 5 },
  ]
    .map(
      (d) =>
        `<text x="20" y="${startY + d.row * (cellSize + cellGap) + 9}" fill="#6e7681" font-family="monospace" font-size="9.5">${d.label}</text>`
    )
    .join('');

  let gridSvg = '';
  metrics.weeks.slice(-52).forEach((week, wIdx) => {
    const delay = (wIdx * 0.025).toFixed(2);
    week.contributionDays.forEach((day, dIdx) => {
      const x = startX + wIdx * (cellSize + cellGap);
      const y = startY + dIdx * (cellSize + cellGap);
      const cls = day.contributionCount > 0 ? 'active-cell' : 'cell';
      const pulseDelay = ((wIdx * 0.07 + dIdx * 0.13) % 3).toFixed(2);
      gridSvg += `<rect class="${cls}" style="animation-delay:${delay}s, ${pulseDelay}s" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2.2" fill="${getGreen(day.contributionCount)}"/>`;
    });
  });

  const legendColors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const legendSquares = legendColors
    .map(
      (c, i) =>
        `<rect x="${706 + i * 15}" y="191" width="10" height="10" rx="2" fill="${c}" stroke="#30363d" stroke-width="0.6">
          ${i > 0 ? `<animate attributeName="opacity" values="0.6;1;0.6" dur="2s" begin="${(i * 0.25).toFixed(2)}s" repeatCount="indefinite"/>` : ''}
        </rect>`
    )
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="radarBeamX" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#39d353" stop-opacity="0"/>
        <stop offset="50%" stop-color="#39d353" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#39d353" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="radarBeamY" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#58a6ff" stop-opacity="0"/>
        <stop offset="50%" stop-color="#58a6ff" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#58a6ff" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="gridClip">
        <rect x="${startX - 2}" y="${startY - 2}" width="752" height="102" rx="4"/>
      </clipPath>
    </defs>
    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      .active-cell {
        transform-box: fill-box;
        transform-origin: center;
        opacity: 0;
        animation: popIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards, pulseCell 3.4s ease-in-out infinite;
      }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes popIn {
        0% { opacity: 0; transform: scale(0.25); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes pulseCell {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.35); }
      }
    </style>
    <rect width="${width}" height="${height}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
    ${terminalHeader(`${CONFIG.username.toLowerCase()}@github ~ $ ./contributions.sh --matrix --radar`, width, 'SYNCED')}

    ${monthLabels}
    ${dayLabels}
    ${gridSvg}

    <!-- Dual Horizontal & Vertical Radar Sweep Beams + Traveling Data Packet -->
    <g clip-path="url(#gridClip)">
      <rect x="-80" y="${startY - 2}" width="80" height="104" fill="url(#radarBeamX)">
        <animate attributeName="x" values="-80;810" dur="5.2s" repeatCount="indefinite"/>
      </rect>
      <rect x="${startX - 2}" y="30" width="752" height="26" fill="url(#radarBeamY)">
        <animate attributeName="y" values="35;175;35" dur="6.8s" repeatCount="indefinite"/>
      </rect>
    </g>

    <!-- Bottom Telemetry HUD Bar -->
    <rect x="20" y="180" width="800" height="32" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="34" y="200" fill="#8b949e" font-family="monospace" font-size="11">
      <tspan fill="#39d353" font-weight="bold">▸ ${metrics.total}</tspan> commits (365d)
    </text>
    <text x="215" y="200" fill="#8b949e" font-family="monospace" font-size="11">
      <tspan fill="#58a6ff" font-weight="bold">▸ ${metrics.activeDays}</tspan> active days
    </text>
    <text x="380" y="200" fill="#8b949e" font-family="monospace" font-size="11">
      <tspan fill="#bc8cff" font-weight="bold">▸ ${metrics.maxDay}</tspan> peak/day
    </text>
    <text x="515" y="200" fill="#8b949e" font-family="monospace" font-size="11">
      <tspan fill="#d29922" font-weight="bold">▸ ${metrics.avgActive}</tspan> avg/day
    </text>

    <text x="674" y="200" fill="#6e7681" font-family="monospace" font-size="10">Less</text>
    ${legendSquares}
    <text x="786" y="200" fill="#6e7681" font-family="monospace" font-size="10">More</text>
  </svg>`;
}

/**
 * 3. Detailed Whoami Portrait + Neofetch Specs + 6 Telemetry Cards + Monthly Analytics Chart (assets/whoami.svg)
 */
function generateWhoamiSVG(metrics, brailleArt) {
  const width = 840;
  const height = 470;

  const linesArr = brailleArt.split('\n').slice(0, 32);
  const isCustomAscii = linesArr.length > 0 && !/[\u2800-\u28FF]/.test(linesArr[0]);
  const fontSize = isCustomAscii ? 8.5 : 8.2;
  const lineDy = isCustomAscii ? 9.3 : 7.6;

  const asciiLines = linesArr
    .map(
      (line, idx) =>
        `<tspan x="84" dy="${idx === 0 ? 0 : lineDy}">${escapeXml(line)}</tspan>`
    )
    .join('');

  // Load segmented studio portrait (scripts/avatar.png) as embedded base64 URI for 1:1 likeness
  const avatarPath = path.join(__dirname, 'avatar.png');
  let avatarImageTag = '';
  if (fs.existsSync(avatarPath)) {
    const b64 = fs.readFileSync(avatarPath).toString('base64');
    avatarImageTag = `
      <!-- High-Definition Segmented Portrait Base Layer -->
      <image x="102" y="46" width="174" height="251" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${b64}" opacity="0.92"/>
      <!-- CRT Terminal Horizontal Scanline Mesh over Portrait -->
      <rect x="18" y="44" width="344" height="255" fill="url(#crtLines)" opacity="0.32"/>
    `;
  }

  const statBox = (x, y, label, value, sub, accent, delay) => `
    <g class="fade-up" style="animation-delay:${delay}s">
      <rect x="${x}" y="${y}" width="132" height="72" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
      <line x1="${x + 10}" y1="${y}" x2="${x + 65}" y2="${y}" stroke="${accent}" stroke-width="2" stroke-linecap="round">
        <animate attributeName="x2" values="${x + 25};${x + 122};${x + 25}" dur="3.8s" begin="${delay}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.35;1;0.35" dur="3.8s" begin="${delay}s" repeatCount="indefinite"/>
      </line>
      <circle cx="${x + 118}" cy="${y + 16}" r="3" fill="${accent}" opacity="0.8">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
      </circle>
      <text x="${x + 12}" y="${y + 20}" fill="#8b949e" font-family="monospace" font-size="10.5">${label}</text>
      <text x="${x + 12}" y="${y + 46}" fill="${accent}" font-family="monospace" font-size="21" font-weight="bold">${value}</text>
      <text x="${x + 12}" y="${y + 62}" fill="#6e7681" font-family="monospace" font-size="9.5">${sub}</text>
    </g>
  `;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxMonth = Math.max(...metrics.monthlyTotals, 1);
  let barsSvg = '';
  const trendPoints = [];
  const chartBaseY = 424;
  const barMaxH = 115;

  metrics.monthlyTotals.forEach((val, i) => {
    const barH = Math.max(6, Math.round((val / maxMonth) * barMaxH));
    const bx = 412 + i * 33;
    const by = chartBaseY - barH;
    const delay = (0.12 + i * 0.06).toFixed(2);
    trendPoints.push(`${bx + 10},${by}`);

    barsSvg += `
      <rect class="bar" style="animation-delay:${delay}s" x="${bx}" y="${by}" width="20" height="${barH}" rx="3" fill="url(#barGrad)"/>
      <text class="fade-up" style="animation-delay:${(0.35 + i * 0.06).toFixed(2)}s" x="${bx + 10}" y="${by - 6}" fill="#7ee787" font-family="monospace" font-size="8.5" font-weight="bold" text-anchor="middle">${val}</text>
      <circle cx="${bx + 10}" cy="${by}" r="2.8" fill="#58a6ff" class="fade-up" style="animation-delay:${(0.4 + i * 0.06).toFixed(2)}s">
        ${val === maxMonth ? `<animate attributeName="r" values="2.8;6;2.8" dur="1.6s" repeatCount="indefinite"/>` : ''}
      </circle>
      <text x="${bx + 10}" y="442" fill="#8b949e" font-family="monospace" font-size="9.5" text-anchor="middle">${months[i]}</text>
    `;
  });

  const areaPoints = `422,${chartBaseY} ${trendPoints.join(' ')} ${412 + 11 * 33 + 10},${chartBaseY}`;
  const trendPolyline = `
    <polygon points="${areaPoints}" fill="url(#trendAreaGrad)" opacity="0.35"/>
    <polyline points="${trendPoints.join(' ')}" fill="none" stroke="#58a6ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="trend-line"/>
  `;

  const swatches = ['#ff5f56', '#ff9e64', '#d29922', '#39d353', '#39c5cf', '#58a6ff', '#bc8cff', '#e6edf3']
    .map(
      (c, idx) =>
        `<rect x="${30 + idx * 22}" y="438" width="15" height="9" rx="2.5" fill="${c}">
          <animate attributeName="y" values="438;435;438" dur="1.8s" begin="${(idx * 0.15).toFixed(2)}s" repeatCount="indefinite"/>
        </rect>`
    )
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#39d353"/>
        <stop offset="100%" stop-color="#0e4429"/>
      </linearGradient>
      <linearGradient id="trendAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#58a6ff" stop-opacity="0.0"/>
      </linearGradient>
      <linearGradient id="portraitScan" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#39d353" stop-opacity="0"/>
        <stop offset="50%" stop-color="#39d353" stop-opacity="0.24"/>
        <stop offset="100%" stop-color="#39d353" stop-opacity="0"/>
      </linearGradient>
      <pattern id="crtLines" width="4" height="3" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="4" y2="0" stroke="#0d1117" stroke-width="1"/>
      </pattern>
      <clipPath id="portraitClip">
        <rect x="18" y="44" width="344" height="255" rx="6"/>
      </clipPath>
    </defs>
    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      .portrait { opacity: 0; animation: fadeIn 1.1s ease forwards, portraitPulse 4.5s ease-in-out infinite; }
      .portrait-overlay { opacity: 0.32; animation: overlayPulse 4.5s ease-in-out infinite; }
      .fade-up { opacity: 0; animation: fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      .bar {
        transform-box: fill-box;
        transform-origin: bottom;
        transform: scaleY(0);
        animation: growBar 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .trend-line {
        stroke-dasharray: 560;
        stroke-dashoffset: 560;
        animation: drawTrend 1.9s ease-out 0.45s forwards;
      }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes fadeIn { to { opacity: 1; } }
      @keyframes portraitPulse {
        0%, 100% { fill: #e6edf3; }
        50% { fill: #7ee787; }
      }
      @keyframes overlayPulse {
        0%, 100% { opacity: 0.22; fill: #39d353; }
        50% { opacity: 0.38; fill: #7ee787; }
      }
      @keyframes fadeUp {
        0% { opacity: 0; transform: translateY(7px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes growBar { to { transform: scaleY(1); } }
      @keyframes drawTrend { to { stroke-dashoffset: 0; } }
    </style>

    <rect width="${width}" height="${height}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
    ${terminalHeader(`${CONFIG.username.toLowerCase()}@github ~ $ neofetch --whoami --analytics`, width, 'ACTIVE')}

    <!-- Left Top: Holographic Portrait Frame -->
    <rect x="18" y="44" width="344" height="255" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <!-- HUD Corner Target Brackets -->
    <path d="M 26 58 L 26 50 L 34 50 M 346 50 L 354 50 L 354 58 M 26 285 L 26 293 L 34 293 M 346 293 L 354 293 L 354 285" fill="none" stroke="#39d353" stroke-width="1.5"/>

    <g clip-path="url(#portraitClip)">
      ${avatarImageTag}
      <text class="${avatarImageTag ? 'portrait-overlay' : 'portrait'}" y="54" fill="#39d353" font-family="monospace" font-size="${fontSize}" xml:space="preserve">${asciiLines}</text>
      <!-- Animated Holographic Scanline over Portrait -->
      <rect x="18" y="44" width="344" height="38" fill="url(#portraitScan)">
        <animate attributeName="y" values="44;299" dur="4.2s" repeatCount="indefinite"/>
      </rect>
    </g>

    <!-- Left Bottom: Neofetch System Specs Box -->
    <rect x="18" y="308" width="344" height="146" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text class="fade-up" style="animation-delay:0.15s" x="30" y="327" fill="#8b949e" font-family="monospace" font-size="10.5">
      <tspan fill="#39d353" font-weight="bold">HOST</tspan>     :: <tspan fill="#e6edf3">Nemal Fernando (@NemalFdo)</tspan>
    </text>
    <text class="fade-up" style="animation-delay:0.25s" x="30" y="345" fill="#8b949e" font-family="monospace" font-size="10.5">
      <tspan fill="#58a6ff" font-weight="bold">KERNEL</tspan>   :: <tspan fill="#e6edf3">Full-Stack &amp; Mobile Engineer</tspan>
    </text>
    <text class="fade-up" style="animation-delay:0.35s" x="30" y="363" fill="#8b949e" font-family="monospace" font-size="10.5">
      <tspan fill="#bc8cff" font-weight="bold">OS/ENV</tspan>   :: <tspan fill="#e6edf3">Win 11 • Linux • Android</tspan>
    </text>
    <text class="fade-up" style="animation-delay:0.45s" x="30" y="381" fill="#8b949e" font-family="monospace" font-size="10.5">
      <tspan fill="#d29922" font-weight="bold">IDE</tspan>      :: <tspan fill="#e6edf3">VS Code • IntelliJ • VS 2022</tspan>
    </text>
    <text class="fade-up" style="animation-delay:0.55s" x="30" y="399" fill="#8b949e" font-family="monospace" font-size="10.5">
      <tspan fill="#39d353" font-weight="bold">EMAIL</tspan>    :: <tspan fill="#e6edf3">dinethnemal2002@gmail.com</tspan>
    </text>
    <text class="fade-up" style="animation-delay:0.65s" x="30" y="417" fill="#8b949e" font-family="monospace" font-size="10.5">
      <tspan fill="#58a6ff" font-weight="bold">STATUS</tspan>   :: <tspan fill="#39d353">● Open to New Opportunities</tspan>
    </text>
    ${swatches}

    <!-- Vertical Divider -->
    <line x1="380" y1="32" x2="380" y2="${height}" stroke="#30363d" stroke-width="1"/>

    <!-- Right Top: 2x3 Color-Coded Metric Grid -->
    ${statBox(396, 44, 'current streak', `${metrics.currentStreak}d`, 'active coding run', '#39d353', 0.1)}
    ${statBox(538, 44, 'longest streak', `${metrics.longestStreak}d`, 'all-time record', '#58a6ff', 0.2)}
    ${statBox(680, 44, 'contributions', `${metrics.total}`, 'last 365 days', '#39d353', 0.3)}

    ${statBox(396, 126, 'active days', `${metrics.activeDays}`, 'days committed', '#bc8cff', 0.4)}
    ${statBox(538, 126, 'max / day', `${metrics.maxDay}`, 'peak daily output', '#d29922', 0.5)}
    ${statBox(680, 126, 'avg / active', `${metrics.avgActive}`, 'commits per day', '#58a6ff', 0.6)}

    <!-- Right Bottom: Detailed Monthly Activity Box with Gridlines, Area Fill & Values -->
    <rect x="396" y="210" width="416" height="244" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="412" y="232" fill="#e6edf3" font-family="monospace" font-size="11.5" font-weight="bold">
      ▸ MONTHLY CONTRIBUTION ANALYTICS (${new Date().getFullYear()})
    </text>
    <text x="798" y="232" fill="#58a6ff" font-family="monospace" font-size="10" text-anchor="end">● trendline + peak</text>

    <!-- Subtle Horizontal Chart Gridlines -->
    <g stroke="#21262d" stroke-width="0.8" stroke-dasharray="3 3">
      <line x1="408" y1="275" x2="800" y2="275"/>
      <line x1="408" y1="325" x2="800" y2="325"/>
      <line x1="408" y1="375" x2="800" y2="375"/>
      <line x1="408" y1="424" x2="800" y2="424"/>
    </g>

    ${trendPolyline}
    ${barsSvg}
  </svg>`;
}

/**
 * 4. Detailed Full-Stack & Mobile Arsenal + Dual Oscilloscope + CI/CD Pipeline (assets/stack.svg)
 */
function generateStackSVG() {
  const width = 840;
  const height = 340;

  const skills = [
    {
      code: 'FRONTEND_WEB',
      tech: 'React • Next.js • Tailwind • HTML/CSS',
      pct: 94,
      barW: 350,
      grad: 'url(#gradGreen)',
      color: '#39d353',
      delay: '0.1s',
    },
    {
      code: 'BACKEND_APIS',
      tech: 'Node.js • Express • NestJS • REST/GraphQL',
      pct: 90,
      barW: 335,
      grad: 'url(#gradCyan)',
      color: '#58a6ff',
      delay: '0.22s',
    },
    {
      code: 'ENTERPRISE',
      tech: 'C# • .NET Core • Java • OOP Architecture',
      pct: 88,
      barW: 327,
      grad: 'url(#gradPurple)',
      color: '#bc8cff',
      delay: '0.34s',
    },
    {
      code: 'DATA_ENG',
      tech: 'MySQL • MariaDB • MongoDB • SQL/NoSQL',
      pct: 86,
      barW: 320,
      grad: 'url(#gradGreen)',
      color: '#39d353',
      delay: '0.46s',
    },
    {
      code: 'MOBILE_&_UX',
      tech: 'Mobile Dev • Figma • Responsive Design',
      pct: 84,
      barW: 312,
      grad: 'url(#gradAmber)',
      color: '#d29922',
      delay: '0.58s',
    },
    {
      code: 'SYSTEMS_SCI',
      tech: 'C • C++ • PHP • MATLAB • Linux/Git',
      pct: 82,
      barW: 305,
      grad: 'url(#gradCyan)',
      color: '#58a6ff',
      delay: '0.7s',
    },
  ];

  const skillBars = skills
    .map((s, idx) => {
      const y = 55 + idx * 45;
      return `
      <g transform="translate(22, ${y})">
        <text x="0" y="0" fill="${s.color}" font-family="monospace" font-size="10.5" font-weight="bold">[${escapeXml(s.code)}]</text>
        <text x="105" y="0" fill="#8b949e" font-family="monospace" font-size="10">${escapeXml(s.tech)}</text>
        <text x="374" y="0" fill="${s.color}" font-family="monospace" font-size="10.5" font-weight="bold" text-anchor="end">${s.pct}%</text>
        <rect x="0" y="7" width="374" height="9" rx="4.5" fill="#161b22" stroke="#30363d" stroke-width="0.8"/>
        <rect x="0" y="7" width="0" height="9" rx="4.5" fill="${s.grad}">
          <animate attributeName="width" from="0" to="${s.barW}" dur="1.35s" begin="${s.delay}" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
        </rect>
      </g>`;
    })
    .join('');

  const pipelineNodes = [
    { x: 452, label: 'DESIGN', sub: 'Figma/UX', color: '#bc8cff', delay: '0s' },
    { x: 542, label: 'FRONTEND', sub: 'Next/React', color: '#58a6ff', delay: '0.6s' },
    { x: 632, label: 'BACKEND', sub: 'Nest/.NET', color: '#39d353', delay: '1.2s' },
    { x: 722, label: 'DEPLOY', sub: 'CI/CD Cloud', color: '#d29922', delay: '1.8s' },
  ];

  const pipelineSvg = pipelineNodes
    .map(
      (n, i) => `
      ${
        i < pipelineNodes.length - 1
          ? `<line x1="${n.x + 74}" y1="184" x2="${n.x + 90}" y2="184" stroke="#30363d" stroke-width="2"/>
             <circle cx="${n.x + 74}" cy="184" r="2.5" fill="#39d353">
               <animate attributeName="cx" values="${n.x + 74};${n.x + 90}" dur="1.2s" begin="${n.delay}" repeatCount="indefinite"/>
             </circle>`
          : ''
      }
      <rect x="${n.x}" y="164" width="74" height="40" rx="5" fill="#0d1117" stroke="${n.color}" stroke-width="1.2">
        <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="2.4s" begin="${n.delay}" repeatCount="indefinite"/>
      </rect>
      <text x="${n.x + 37}" y="181" fill="${n.color}" font-family="monospace" font-size="9.5" font-weight="bold" text-anchor="middle">${n.label}</text>
      <text x="${n.x + 37}" y="195" fill="#8b949e" font-family="monospace" font-size="8.5" text-anchor="middle">${n.sub}</text>
    `
    )
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gradGreen" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0e4429"/>
        <stop offset="100%" stop-color="#39d353"/>
      </linearGradient>
      <linearGradient id="gradCyan" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1f6feb"/>
        <stop offset="100%" stop-color="#58a6ff"/>
      </linearGradient>
      <linearGradient id="gradPurple" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#6e40c9"/>
        <stop offset="100%" stop-color="#bc8cff"/>
      </linearGradient>
      <linearGradient id="gradAmber" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#9e6a03"/>
        <stop offset="100%" stop-color="#d29922"/>
      </linearGradient>
    </defs>
    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      .fade-line { opacity: 0; animation: fadeIn 0.5s ease forwards; }
      .ecg-wave-1 {
        stroke-dasharray: 440;
        stroke-dashoffset: 440;
        animation: pulseWave 3s linear infinite;
      }
      .ecg-wave-2 {
        stroke-dasharray: 440;
        stroke-dashoffset: 440;
        animation: pulseWave 4.2s linear infinite;
      }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes fadeIn { to { opacity: 1; } }
      @keyframes pulseWave {
        0% { stroke-dashoffset: 440; opacity: 0.35; }
        50% { opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 0.35; }
      }
    </style>

    <rect width="${width}" height="${height}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
    ${terminalHeader(`${CONFIG.username.toLowerCase()}@github ~ $ ./stack-telemetry.sh --monitor`, width, 'TELEMETRY', '#58a6ff')}

    <!-- Left Column: 6 Animated Skill Telemetry Bars -->
    ${skillBars}

    <!-- Center Divider -->
    <line x1="416" y1="32" x2="416" y2="${height}" stroke="#30363d" stroke-width="1"/>

    <!-- Right Top: Dual-Channel Oscilloscope Heartbeat Monitor -->
    <rect x="434" y="46" width="384" height="86" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="448" y="64" fill="#e6edf3" font-family="monospace" font-size="10.5" font-weight="bold">▸ RUNTIME OSCILLOSCOPE // CODING STREAM</text>
    <text x="804" y="64" fill="#39d353" font-family="monospace" font-size="9.5" text-anchor="end">99.8% UPTIME</text>

    <!-- Channel 1 (Green ECG) & Channel 2 (Cyan Harmonic) -->
    <path class="ecg-wave-2" d="M 448 102 Q 485 78 522 102 T 596 102 T 670 102 T 744 102 T 804 102" fill="none" stroke="#58a6ff" stroke-width="1.4" opacity="0.7"/>
    <path class="ecg-wave-1" d="M 448 102 L 492 102 L 505 82 L 516 118 L 530 72 L 544 118 L 556 94 L 570 102 L 626 102 L 640 80 L 652 116 L 666 74 L 680 114 L 692 102 L 804 102" fill="none" stroke="#39d353" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Right Middle: Animated Architecture Pipeline -->
    <rect x="434" y="142" width="384" height="72" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="448" y="157" fill="#8b949e" font-family="monospace" font-size="10">▸ FULL-STACK DELIVERY PIPELINE (LIVE DATA FLOW)</text>
    ${pipelineSvg}

    <!-- Right Bottom: htop Active Process Daemons -->
    <rect x="434" y="224" width="384" height="98" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="448" y="242" fill="#58a6ff" font-family="monospace" font-size="10" font-weight="bold">PID   DAEMON              STACK                  STATE</text>
    <text class="fade-line" style="animation-delay:0.2s" x="448" y="261" fill="#8b949e" font-family="monospace" font-size="10">
      <tspan fill="#e6edf3">2002</tspan>  fullstack-core      Next.js + NestJS       <tspan fill="#39d353" font-weight="bold">[RUNNING]</tspan>
    </text>
    <text class="fade-line" style="animation-delay:0.35s" x="448" y="279" fill="#8b949e" font-family="monospace" font-size="10">
      <tspan fill="#e6edf3">3045</tspan>  enterprise-api      C# + .NET + Java       <tspan fill="#58a6ff" font-weight="bold">[ACTIVE]</tspan>
    </text>
    <text class="fade-line" style="animation-delay:0.5s" x="448" y="297" fill="#8b949e" font-family="monospace" font-size="10">
      <tspan fill="#e6edf3">4110</tspan>  mobile-engine       Android + Cross-Plat   <tspan fill="#bc8cff" font-weight="bold">[BUILDING]</tspan>
    </text>
    <text class="fade-line" style="animation-delay:0.65s" x="448" y="314" fill="#8b949e" font-family="monospace" font-size="10">
      <tspan fill="#e6edf3">5173</tspan>  db-cluster          MySQL + MongoDB        <tspan fill="#39d353" font-weight="bold">[HEALTHY]</tspan>
    </text>
  </svg>`;
}

/**
 * 5. Detailed Terminal Connection & Command Prompt Footer (assets/links.svg)
 */
function generateLinksSVG() {
  const width = 840;
  const height = 148;

  const cards = [
    { x: 22, label: '01 // GITHUB', val: 'github.com/NemalFdo', color: '#39d353' },
    { x: 220, label: '02 // LINKEDIN', val: 'in/nemal-fernando', color: '#58a6ff' },
    { x: 418, label: '03 // EMAIL', val: 'dinethnemal2002@gmail.com', color: '#bc8cff' },
    { x: 644, label: '04 // BASE', val: 'Sri Lanka (LK)', color: '#d29922' },
  ];

  const cardsSvg = cards
    .map((c, i) => {
      const w = i === 2 ? 216 : i === 3 ? 174 : 188;
      return `
      <rect x="${c.x}" y="48" width="${w}" height="52" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
      <text x="${c.x + 12}" y="67" fill="${c.color}" font-family="monospace" font-size="10" font-weight="bold">▸ ${escapeXml(c.label)}</text>
      <text x="${c.x + 12}" y="87" fill="#e6edf3" font-family="monospace" font-size="11">${escapeXml(c.val)}</text>
    `;
    })
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      .glow { animation: textGlow 3s ease-in-out infinite; }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes textGlow { 0%, 100% { fill: #39d353; } 50% { fill: #58a6ff; } }
    </style>
    <rect width="${width}" height="${height}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
    ${terminalHeader(`${CONFIG.username.toLowerCase()}@github ~ $ ./connect.sh --endpoints`, width, 'READY')}

    ${cardsSvg}

    <rect x="22" y="110" width="796" height="26" rx="5" fill="#161b22" stroke="#30363d" stroke-width="0.8"/>
    <text x="36" y="127" fill="#8b949e" font-family="monospace" font-size="11">
      <tspan fill="#39d353" font-weight="bold">nemalfdo@github</tspan>:<tspan fill="#58a6ff">~</tspan>$ echo &quot;Let&apos;s collaborate on Full-Stack, Mobile &amp; Open-Source projects!&quot;<tspan class="cursor"> █</tspan>
    </text>
  </svg>`;
}

async function main() {
  const userData = await fetchGitHubStats();
  const metrics = userData ? calculateMetrics(userData) : loadFallbackMetrics();
  const brailleArt = await buildBraillePortrait(userData?.avatarUrl);

  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(assetsDir, 'hero.svg'), generateHeroSVG(metrics));
  fs.writeFileSync(path.join(assetsDir, 'contributions.svg'), generateContributionsSVG(metrics));
  fs.writeFileSync(path.join(assetsDir, 'whoami.svg'), generateWhoamiSVG(metrics, brailleArt));
  fs.writeFileSync(path.join(assetsDir, 'stack.svg'), generateStackSVG());
  fs.writeFileSync(path.join(assetsDir, 'links.svg'), generateLinksSVG());

  console.log('Animated SVGs generated successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
