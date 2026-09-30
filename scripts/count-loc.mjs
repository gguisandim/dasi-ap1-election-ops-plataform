import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md', '.sql']);
const ignored = new Set(['node_modules', 'dist', 'build', '.git', '.next']);
let files = 0;
let lines = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) {
      files += 1;
      const text = fs.readFileSync(full, 'utf8');
      lines += text === '' ? 0 : text.split(/\r?\n/).length;
    }
  }
}

walk(root);
console.log(`Arquivos contados: ${files}`);
console.log(`Linhas contadas: ${lines}`);
