// EMBERLINE — make.fun gta6-01 hand-in program (round 3 redo).
//
// The game is plain static files under game/ (three.js vendored as a
// minified build; every other file written for this entry). This program
// is the hand-in: it walks game/ and screenshots/ file by file into the
// output directory (/output in the grader, MAKEFUN_OUTPUT_DIR anywhere
// else) and writes dossier.json with the kit's vendored library, exactly
// the way the scorer rebuilds it. Node 22 standard library only.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

// Recursive copy that skips nothing and reports how many files landed.
function copyTree(from, to) {
  let copied = 0;
  const walk = (srcDir, dstDir) => {
    mkdirSync(dstDir, { recursive: true });
    for (const entry of readdirSync(srcDir)) {
      const src = join(srcDir, entry);
      const dst = join(dstDir, entry);
      if (statSync(src).isDirectory()) walk(src, dst);
      else { copyFileSync(src, dst); copied++; }
    }
  };
  walk(from, to);
  return copied;
}

mkdirSync(outputDir, { recursive: true });
const gameFiles = copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));

let shotFiles = 0;
const screenshotsFrom = join(repoRoot, 'screenshots');
if (existsSync(screenshotsFrom)) {
  shotFiles = copyTree(screenshotsFrom, join(outputDir, 'screenshots'));
} else {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, SCORER_CAPS));
console.log(`EMBERLINE handed in: ${gameFiles} game files + ${shotFiles} screenshots copied, dossier written to ${outputDir}`);
