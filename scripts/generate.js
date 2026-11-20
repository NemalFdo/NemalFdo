const fs = require('fs');
const path = require('path');

const CONFIG = {
  username: 'NemalFdo',
  tagline: 'Software Engineer • Full-Stack & Mobile Developer',
  links: 'github.com/NemalFdo  •  linkedin.com/in/nemal-fernando  •  Sri Lanka',
};

const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('Missing GH_PAT or GITHUB_TOKEN.');
  process.exit(1);
}

const escapeXml = (unsafe) =>
  String(unsafe).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[c]));

async function fetchGitHubStats() {
  const query = `
    query($username: String!) {
      user(login: $username) {
        avatarUrl(size: 400)
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
}

// Converts an image (local scripts/avatar.png or GitHub avatarUrl) to crisp Braille art
async function buildBraillePortrait(avatarUrl) {
  const customAsciiPath = path.join(__dirname, 'ascii.txt');
  if (fs.existsSync(customAsciiPath)) {
    const content = fs.readFileSync(customAsciiPath, 'utf8').trim();
    if (content.length > 50) return content;
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

  // Target 44 chars wide x 28 lines tall (each Braille char = 2x4 pixels -> 88x112 px)
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

function calculateMetrics(calendar) {
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

  return {
    total: calendar.totalContributions.toLocaleString(),
    currentStreak,
    longestStreak,
    activeDays,
    maxDay,
    avgActive,
    weeks,
    monthlyTotals,
  };
}

function terminalHeader(title, width) {
  return `
    <rect x="0" y="0" width="${width}" height="32" rx="8" fill="#161b22"/>
    <rect x="0" y="16" width="${width}" height="16" fill="#161b22"/>
    <circle cx="18" cy="16" r="5" fill="#ff5f56"/>
    <circle cx="36" cy="16" r="5" fill="#ffbd2e"/>
    <circle cx="54" cy="16" r="5" fill="#27c93f"/>
    <text x="${width / 2}" y="20" fill="#8b949e" font-family="monospace" font-size="12" text-anchor="middle">${escapeXml(title)}<tspan class="cursor">_</tspan></text>
    <line x1="0" y1="32" x2="${width}" y2="32" stroke="#30363d" stroke-width="1"/>
  `;
}

function generateContributionsSVG(metrics) {
  const width = 840;
  const height = 185;
  const cellSize = 11;
  const cellGap = 3.5;
  const startX = 28;
  const startY = 55;

  const getGreen = (count) => {
    if (count === 0) return '#161b22';
    if (count <= 2) return '#0e4429';
    if (count <= 5) return '#006d32';
    if (count <= 10) return '#26a641';
    return '#39d353';
  };

  let gridSvg = '';
  metrics.weeks.slice(-52).forEach((week, wIdx) => {
    const delay = (wIdx * 0.03).toFixed(2);
    week.contributionDays.forEach((day, dIdx) => {
      const x = startX + wIdx * (cellSize + cellGap);
      const y = startY + dIdx * (cellSize + cellGap);
      const cls = day.contributionCount > 0 ? 'active-cell' : 'cell';
      gridSvg += `<rect class="${cls}" style="animation-delay:${delay}s" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${getGreen(day.contributionCount)}"/>`;
    });
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      .active-cell { opacity: 0; animation: popIn 0.5s ease forwards, pulse 4s ease-in-out infinite; }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes popIn { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
      @keyframes pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
    </style>
    <rect width="${width}" height="${height}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
    ${terminalHeader(`${CONFIG.username.toLowerCase()}@github ~ $ ./contributions.sh`, width)}
    ${gridSvg}
    <text x="28" y="168" fill="#8b949e" font-family="monospace" font-size="12">${metrics.total} contributions in the last year</text>
  </svg>`;
}

function generateWhoamiSVG(metrics, brailleArt) {
  const width = 840;
  const height = 390;

  const asciiLines = brailleArt
    .split('\n')
    .slice(0, 30)
    .map(
      (line, idx) =>
        `<tspan x="26" dy="${idx === 0 ? 0 : 11}">${escapeXml(line)}</tspan>`
    )
    .join('');

  const statBox = (x, y, label, value, sub, delay) => `
    <g class="fade-up" style="animation-delay:${delay}s">
      <rect x="${x}" y="${y}" width="132" height="68" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
      <text x="${x + 12}" y="${y + 20}" fill="#8b949e" font-family="monospace" font-size="11">${label}</text>
      <text x="${x + 12}" y="${y + 44}" fill="#39d353" font-family="monospace" font-size="20" font-weight="bold">${value}</text>
      <text x="${x + 12}" y="${y + 59}" fill="#6e7681" font-family="monospace" font-size="10">${sub}</text>
    </g>
  `;

  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const maxMonth = Math.max(...metrics.monthlyTotals, 1);
  let barsSvg = '';
  metrics.monthlyTotals.forEach((val, i) => {
    const barMaxH = 58;
    const barH = Math.max(4, Math.round((val / maxMonth) * barMaxH));
    const bx = 408 + i * 33;
    const by = 345 - barH;
    const delay = (0.1 + i * 0.06).toFixed(2);
    barsSvg += `
      <rect class="bar" style="animation-delay:${delay}s; transform-origin: ${bx + 10}px 345px;" x="${bx}" y="${by}" width="20" height="${barH}" rx="2" fill="#39d353"/>
      <text x="${bx + 10}" y="360" fill="#8b949e" font-family="monospace" font-size="10" text-anchor="middle">${months[i]}</text>
    `;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      .portrait { opacity: 0; animation: fadeIn 1.2s ease forwards; }
      .fade-up { opacity: 0; animation: fadeIn 0.6s ease forwards; }
      .bar { transform: scaleY(0); animation: growBar 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes fadeIn { to { opacity: 1; } }
      @keyframes growBar { to { transform: scaleY(1); } }
    </style>
    <rect width="${width}" height="${height}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
    ${terminalHeader(`${CONFIG.username.toLowerCase()}@github ~ $ whoami`, width)}

    <!-- Left Braille Portrait -->
    <text class="portrait" y="54" fill="#e6edf3" font-family="monospace" font-size="11" xml:space="preserve">${asciiLines}</text>

    <!-- Divider -->
    <line x1="380" y1="32" x2="380" y2="${height}" stroke="#30363d" stroke-width="1"/>

    <!-- Right 2x3 Metric Grid -->
    ${statBox(396, 48, 'current streak', `${metrics.currentStreak}d`, 'active run', 0.1)}
    ${statBox(538, 48, 'longest streak', `${metrics.longestStreak}d`, 'all-time best', 0.2)}
    ${statBox(680, 48, 'contributions', `${metrics.total}`, 'last 365 days', 0.3)}

    ${statBox(396, 126, 'active days', `${metrics.activeDays}`, 'days coded', 0.4)}
    ${statBox(538, 126, 'max / day', `${metrics.maxDay}`, 'peak output', 0.5)}
    ${statBox(680, 126, 'avg / active', `${metrics.avgActive}`, 'commits / day', 0.6)}

    <!-- Bottom Monthly Activity Box -->
    <rect x="396" y="210" width="416" height="162" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="410" y="232" fill="#8b949e" font-family="monospace" font-size="11">contributions / month (${new Date().getFullYear()})</text>
    ${barsSvg}
  </svg>`;
}

function generateLinksSVG() {
  const width = 840;
  const height = 105;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .cursor { animation: blink 1s step-end infinite; fill: #39d353; }
      .glow { animation: textGlow 3s ease-in-out infinite; }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes textGlow { 0%, 100% { fill: #39d353; } 50% { fill: #7ee787; } }
    </style>
    <rect width="${width}" height="${height}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>
    ${terminalHeader(`${CONFIG.username.toLowerCase()}@github ~ $ ./links.sh`, width)}
    <text x="${width / 2}" y="62" fill="#e6edf3" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle">${escapeXml(CONFIG.tagline)}</text>
    <text class="glow" x="${width / 2}" y="84" font-family="monospace" font-size="12" text-anchor="middle">${escapeXml(CONFIG.links)}</text>
  </svg>`;
}

async function main() {
  const userData = await fetchGitHubStats();
  const metrics = calculateMetrics(userData.contributionsCollection.contributionCalendar);
  const brailleArt = await buildBraillePortrait(userData.avatarUrl);

  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

  fs.writeFileSync(path.join(assetsDir, 'contributions.svg'), generateContributionsSVG(metrics));
  fs.writeFileSync(path.join(assetsDir, 'whoami.svg'), generateWhoamiSVG(metrics, brailleArt));
  fs.writeFileSync(path.join(assetsDir, 'links.svg'), generateLinksSVG());

  console.log('Animated SVGs generated successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});