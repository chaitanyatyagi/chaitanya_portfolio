// ---------------------------------------------------------------------------
// One-time grader setup (like `npm install`; run at deploy/image build time):
//   1. downloads the pure-Python wheels for the PySpark API (sqlframe and its
//      PyPI-only dependencies) into grader/wheels/, pinned;
//   2. warms Pyodide's package cache (duckdb, pytz, …) inside node_modules.
// After this, sandboxes need NO network access at all — they run with
// read-only filesystem permissions and load everything from local files.
//   npm run grader:prepare
// ---------------------------------------------------------------------------
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { config } from '../src/config.js';
import { SANDBOX_PACKAGES } from './packages.js';

// Pinned, pure-Python (py3-none-any) wheels from PyPI.
const WHEELS = [
  ['sqlframe', '4.10.0'],
  ['sqlglot', '30.29.0'],   // sqlframe 4.10 requires sqlglot < 30.30
  ['prettytable', '3.18.0'],
];

async function downloadWheel(name, version) {
  const meta = await (await fetch(`https://pypi.org/pypi/${name}/${version}/json`)).json();
  const file = meta.urls.find((u) => u.filename.endsWith('py3-none-any.whl'));
  if (!file) throw new Error(`No pure-Python wheel for ${name}==${version}`);
  const target = path.join(config.grader.wheelsDir, file.filename);
  try {
    await fs.access(target);
    return `${file.filename} (cached)`;
  } catch {
    const buf = Buffer.from(await (await fetch(file.url)).arrayBuffer());
    const digest = (await import('node:crypto')).createHash('sha256').update(buf).digest('hex');
    if (digest !== file.digests.sha256) throw new Error(`Checksum mismatch for ${file.filename}`);
    await fs.writeFile(target, buf);
    return file.filename;
  }
}

{
  await fs.mkdir(config.grader.wheelsDir, { recursive: true });
  for (const [name, version] of WHEELS) console.log('wheel:', await downloadWheel(name, version));
  const py = await loadPyodide();
  const all = [...new Set(Object.values(SANDBOX_PACKAGES).flat())];
  await py.loadPackage(all, { messageCallback: () => {} });
  console.log('✓ Pyodide package cache warm:', all.join(', '));
}
