// Checks that every file listed in src/audio/sampleConfig.ts exists in
// public/audio/, and lists audio files on disk that are not configured.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(root, 'src/audio/sampleConfig.ts'), 'utf8');
const listOf = (name) => {
  const block = config.slice(config.indexOf(`${name}: readonly`), config.indexOf('];', config.indexOf(`${name}: readonly`)));
  return [...block.matchAll(/'([^']+\.(?:wav|mp3|ogg|flac|m4a|aiff?))'/gi)].map((m) => m[1]);
};
const nfc = (f) => f.normalize('NFC');
let failed = false;
// Dark Mode uses SAMPLE_FILES in public/audio/, Light Mode LIGHT_SAMPLE_FILES in public/audio/light/.
for (const [name, sub] of [['SAMPLE_FILES', ''], ['LIGHT_SAMPLE_FILES', 'light/']]) {
  const listed = listOf(name).map((f) => f.slice(sub.length));
  const dir = join(root, 'public/audio', sub);
  const onDisk = existsSync(dir) ? readdirSync(dir) : [];
  const missing = listed.filter((f) => !onDisk.some((d) => nfc(d) === nfc(f)));
  const unlisted = onDisk.filter((f) => /\.(wav|mp3|ogg|flac|m4a|aiff?)$/i.test(f) && !listed.some((l) => nfc(l) === nfc(f)));
  // Same name in a different Unicode form (e.g. NFD from macOS): the app copes,
  // but report it so the file can be renamed if a server is strict.
  for (const f of onDisk) {
    if (f !== nfc(f) && listed.some((l) => nfc(l) === nfc(f))) console.warn(`NOTE  public/audio/${sub}${f} uses decomposed (NFD) Unicode; the app will still find it.`);
  }
  console.log(`${name}: configured ${listed.length}, found on disk ${listed.length - missing.length}`);
  for (const f of missing) console.error(`MISSING  public/audio/${sub}${f}`);
  for (const f of unlisted) console.warn(`NOT CONFIGURED  public/audio/${sub}${f} (add it to ${name} to use it)`);
  if (missing.length) failed = true;
}
process.exit(failed ? 1 : 0);
