// Update manifest.json to point to the latest (alphabetically or by mtime) HTML file in /exports
// Usage: node scripts/update-manifest.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const exportsDir = path.join(root, 'exports');
const manifestPath = path.join(root, 'manifest.json');

async function main(){
  const entries = await fs.readdir(exportsDir, { withFileTypes: true });
  const htmls = await Promise.all(entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.html'))
    .map(async e => {
      const full = path.join(exportsDir, e.name);
      const stat = await fs.stat(full);
      return { name: e.name, mtime: stat.mtimeMs };
    }));
  if(!htmls.length) throw new Error('No .html files in /exports');
  htmls.sort((a,b)=> b.mtime - a.mtime);
  const latest = htmls[0].name;

  let manifest = { title: 'Playbook', version: '1.0.0' };
  try{
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  }catch{ /* ignore */ }

  manifest.export_html = `exports/${latest}`;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('manifest.json updated ->', manifest.export_html);
}

main().catch(err=>{ console.error(err); process.exit(1); });
