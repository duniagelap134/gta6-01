// SOLMAR — the entrypoint: copies game/ and screenshots/ into the
// output directory and writes the dossier from the kit's library, so
// the gate can check the entry byte for byte. Node 22, stdlib only.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir)) throw new Error('SOLMAR main.ts: game/ is missing from ' + repoRoot);
if (!existsSync(shotsDir)) throw new Error('SOLMAR main.ts: screenshots/ is missing from ' + repoRoot);

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('SOLMAR: wrote ' + outDir + '/dossier.json (' + dossier.length + ' bytes)');
