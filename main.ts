// EMBERLINE — make.fun gta6-01 hand-in program (round 3 re-author).
//
// The game is plain static files under game/ (three.js vendored as a
// minified build; every other file written for this entry). This program
// is the hand-in: it copies game/ and screenshots/ into the output
// directory (/output in the grader, MAKEFUN_OUTPUT_DIR anywhere else)
// and writes dossier.json with the kit's vendored library, exactly the
// way the scorer rebuilds it. Node 22 standard library only.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, passed through so this program refuses exactly
// what the scorer would refuse.
const SCORER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));

const screenshotsFrom = join(repoRoot, 'screenshots');
if (existsSync(screenshotsFrom)) {
  copyTree(screenshotsFrom, join(outputDir, 'screenshots'));
} else {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, SCORER_CAPS));
console.log('EMBERLINE handed in: game + screenshots copied, dossier written to', outputDir);
