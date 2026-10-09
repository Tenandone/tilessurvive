'use strict';
const fs = require('node:fs');
const path = require('node:path');

function canonical(candidate) {
  let existing = path.resolve(candidate);
  const suffix = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw Error('No existing ancestor for path');
    suffix.unshift(path.basename(existing)); existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...suffix);
}
function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function publicRoots() {
  const current = canonical(path.resolve(__dirname, '../..')), roots = new Set([current]);
  const marker = path.join(current, '.git');
  if (!fs.existsSync(marker)) return [...roots];
  let gitDir = marker;
  if (fs.statSync(marker).isFile()) {
    const match = /^gitdir:\s*(.+)\s*$/m.exec(fs.readFileSync(marker,'utf8'));
    if (!match) throw Error('Public worktree Git marker is invalid');
    gitDir = path.resolve(current,match[1].trim());
  }
  const commonFile = path.join(gitDir,'commondir');
  const common = fs.existsSync(commonFile) ? path.resolve(gitDir,fs.readFileSync(commonFile,'utf8').trim()) : gitDir;
  if (path.basename(common)==='.git') roots.add(canonical(path.dirname(common)));
  const linked = path.join(common,'worktrees');
  if (fs.existsSync(linked)) for (const entry of fs.readdirSync(linked,{withFileTypes:true})) {
    const linkFile = path.join(linked,entry.name,'gitdir');
    if (entry.isDirectory() && fs.existsSync(linkFile)) {
      const target=fs.readFileSync(linkFile,'utf8').trim();
      if (target && fs.existsSync(target)) roots.add(canonical(path.dirname(target)));
    }
  }
  return [...roots];
}
function assertPrivate(candidate, label = 'Raw path') {
  const absolute = canonical(candidate);
  if (publicRoots().some(root => within(root,absolute))) throw Error(label + ' must be outside the public repository and its linked worktrees: ' + absolute);
  return absolute;
}
function inputWithin(root, candidate) {
  const actual = fs.realpathSync(path.resolve(root, candidate));
  if (!within(fs.realpathSync(root), actual)) throw Error('Input escapes approved source directory');
  assertPrivate(actual, 'Input file');
  if (!fs.statSync(actual).isFile()) throw Error('Input must be a regular local file');
  return actual;
}
function newPrivateDirectory(candidate) {
  const out = assertPrivate(candidate, 'Output directory');
  if (fs.existsSync(out)) throw Error('Output already exists; choose a new snapshot directory');
  fs.mkdirSync(out, { recursive: true }); return fs.realpathSync(out);
}
module.exports = { canonical, within, publicRoots, assertPrivate, inputWithin, newPrivateDirectory };
