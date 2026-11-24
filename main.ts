// EMBERLINE dossier builder — writes makefun/dossier/v1 for this entry.
// Run: MAKEFUN_OUTPUT_DIR=/tmp/emberline-out node main.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? join(process.cwd(), 'out');
mkdirSync(outDir, { recursive: true });
const dossier = buildDossier('.', {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
