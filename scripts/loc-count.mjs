import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

// Konfig: hvilke filer som telles (enkelt og eksplisitt)
const COUNT_EXTS = new Set(['.js', '.ts', '.css', '.html', '.md']);
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '.github', 'assets', 'public']);

function shouldSkipDir(name){ return EXCLUDE_DIRS.has(name); }
function shouldCountFile(file){ return COUNT_EXTS.has(extname(file).toLowerCase()); }

function walk(dir){
  let total = 0;
  for(const name of readdirSync(dir)){
    const p = join(dir, name);
    const st = statSync(p);
    if(st.isDirectory()){
      if(shouldSkipDir(name)) continue;
      total += walk(p);
    }else{
      if(!shouldCountFile(p)) continue;
      const content = readFileSync(p, 'utf8');
      // Teller antall linjer (inkl. tomme) – rask og deterministisk
      total += content.split('\n').length;
    }
  }
  return total;
}

const root = process.cwd();
const total = walk(root);
console.log(total);
