const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();

// Google Analytics 코드
const GA_SNIPPET = `
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z2MJ6TXZHK"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-Z2MJ6TXZHK');
  </script>
`;

// 제외할 폴더
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.github'
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.html')) continue;

    insertGA(fullPath);
  }
}

function insertGA(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  // 이미 들어간 파일은 건너뜀
  if (html.includes('G-Z2MJ6TXZHK')) {
    console.log(`skip: ${filePath}`);
    return;
  }

  // </head> 바로 위에 삽입
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${GA_SNIPPET}\n</head>`);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`updated: ${filePath}`);
    return;
  }

  console.log(`no </head> found: ${filePath}`);
}

walk(ROOT_DIR);
console.log('Done.');