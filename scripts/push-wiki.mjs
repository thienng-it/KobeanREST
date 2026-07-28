import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const REPO_WIKI_URL = 'https://github.com/thienng-it/KobeanREST.wiki.git';
const SOURCE_DIR = join(process.cwd(), '.github', 'WIKI');
const TEMP_DIR = join(process.cwd(), '.tmp_wiki_repo');

console.log('🚀 Synchronizing KobeanREST GitHub Wiki...');

try {
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }

  console.log(`📡 Cloning ${REPO_WIKI_URL}...`);
  try {
    execSync(`git clone ${REPO_WIKI_URL} "${TEMP_DIR}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('\n⚠️ Note: If the wiki repository is not initialized on GitHub yet:');
    console.error('   1. Open https://github.com/thienng-it/KobeanREST/wiki');
    console.error('   2. Click "Create the first page" and save a initial Home page.');
    console.error('   3. Re-run "npm run push:wiki".\n');
    throw err;
  }

  const wikiFiles = readdirSync(SOURCE_DIR);
  for (const file of wikiFiles) {
    if (file.endsWith('.md')) {
      copyFileSync(join(SOURCE_DIR, file), join(TEMP_DIR, file));
      console.log(`  📄 Copied ${file}`);
    }
  }

  execSync('git add .', { cwd: TEMP_DIR, stdio: 'inherit' });
  
  try {
    execSync('git commit -m "docs(wiki): update app wiki documentation from .github/WIKI"', {
      cwd: TEMP_DIR,
      stdio: 'inherit'
    });
  } catch {
    console.log('ℹ️ No changes to commit.');
  }

  console.log('⬆️ Pushing updates to GitHub Wiki...');
  const currentBranch = execSync('git symbolic-ref --short HEAD', { cwd: TEMP_DIR }).toString().trim() || 'master';
  execSync(`git push origin ${currentBranch}`, { cwd: TEMP_DIR, stdio: 'inherit' });

  rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('✅ KobeanREST GitHub Wiki updated successfully!');
} catch (error) {
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  process.exit(1);
}
