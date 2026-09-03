import { readdirSync, symlinkSync, existsSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const standaloneDir = join(fileURLToPath(import.meta.url), '..', '..', 'apps', 'web', '.next', 'standalone');
const nmDir = join(standaloneDir, 'node_modules');
const pnpmDir = join(nmDir, '.pnpm');

if (!existsSync(pnpmDir)) {
  console.log('No .pnpm directory found, skipping standalone node_modules fix');
  process.exit(0);
}

// Collect all available packages from the .pnpm store
const allPkgs = new Map(); // pkgName -> { src, priority }

function parsePnpmEntry(entryName) {
  // pnpm entry format: pkg@version or pkg@version_peerDep@pdv...
  // A "direct" entry starts with pkgName@version where version is a semver range.
  // Peer deps are appended with _depName@depVersion.
  const atIndex = entryName.indexOf('@');
  if (atIndex === -1) return null;
  const pkgName = entryName.slice(0, atIndex);
  // A "direct" entry has the package name at the start (no underscore before the version)
  return { pkgName };
}

const entries = readdirSync(pnpmDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name === 'node_modules') continue;

  const parsed = parsePnpmEntry(entry.name);
  const pkgNodeModules = join(pnpmDir, entry.name, 'node_modules');
  if (!existsSync(pkgNodeModules)) continue;

  const subEntries = readdirSync(pkgNodeModules, { withFileTypes: true });
  for (const sub of subEntries) {
    const processPkg = (fullName, src) => {
      const existing = allPkgs.get(fullName);
      // Direct = the .pnpm entry's package name matches the file being linked
      const isDirect = parsed && parsed.pkgName === fullName;
      const priority = isDirect ? 0 : 1;
      if (!existing || priority < existing.priority) {
        allPkgs.set(fullName, { src, priority });
      }
    };

    if (sub.name.startsWith('@')) {
      const scopedDir = join(pkgNodeModules, sub.name);
      if (!existsSync(scopedDir)) continue;
      const innerEntries = readdirSync(scopedDir, { withFileTypes: true });
      for (const inner of innerEntries) {
        processPkg(`${sub.name}/${inner.name}`, join(scopedDir, inner.name));
      }
    } else {
      processPkg(sub.name, join(pkgNodeModules, sub.name));
    }
  }
}

// Create symlinks for all packages
for (const [name, { src }] of allPkgs) {
  const dest = join(nmDir, name);
  if (!existsSync(dest)) {
    const parentDir = name.includes('/') ? join(nmDir, name.split('/')[0]) : nmDir;
    mkdirSync(parentDir, { recursive: true });
    const relPath = relative(parentDir, src);
    symlinkSync(relPath, dest, 'junction');
    console.log(`Linked: ${name}`);
  }
}

console.log('Standalone node_modules fixed.');
