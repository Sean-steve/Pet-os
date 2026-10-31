import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dist=path.resolve('dist');
const htmlPath=path.join(dist,'index.html');
if(!fs.existsSync(htmlPath))throw new Error('PERF_DIST_MISSING: run npm run build first');
const html=fs.readFileSync(htmlPath,'utf8');
const entryMatch=html.match(/<script[^>]+src="([^"]+\.js)"/);
if(!entryMatch)throw new Error('PERF_ENTRY_NOT_FOUND');
const entryName=path.basename(entryMatch[1]);
const assetsDir=path.join(dist,'assets');
const files=fs.readdirSync(assetsDir);
const js=files.filter(f=>f.endsWith('.js'));
const css=files.filter(f=>f.endsWith('.css'));
const kb=(n:number)=>n/1024;
const gzipKb=(p:string)=>kb(zlib.gzipSync(fs.readFileSync(p)).length);
const rawKb=(p:string)=>kb(fs.statSync(p).size);
const entryPath=path.join(assetsDir,entryName);
if(!fs.existsSync(entryPath))throw new Error('PERF_ENTRY_ASSET_MISSING: '+entryName);

const metrics={
  ENTRY_JS_RAW_KB:rawKb(entryPath),
  ENTRY_JS_GZIP_KB:gzipKb(entryPath),
  MAX_CHUNK_RAW_KB:Math.max(0,...js.map(f=>rawKb(path.join(assetsDir,f)))),
  TOTAL_JS_GZIP_KB:js.reduce((n,f)=>n+gzipKb(path.join(assetsDir,f)),0),
  CSS_GZIP_KB:css.reduce((n,f)=>n+gzipKb(path.join(assetsDir,f)),0),
};
const limits={ENTRY_JS_RAW_KB:900,ENTRY_JS_GZIP_KB:250,MAX_CHUNK_RAW_KB:1200,TOTAL_JS_GZIP_KB:950,CSS_GZIP_KB:40};
let failed=false;
for(const key of Object.keys(limits) as Array<keyof typeof limits>){
  const value=metrics[key],limit=limits[key],ok=value<=limit;
  console.log(`[${ok?'OK':'FAIL'}] ${key}: ${value.toFixed(2)} KB <= ${limit} KB`);
  if(!ok)failed=true;
}
console.log(`Assets: ${js.length} JS chunks, ${css.length} CSS files; entry=${entryName}`);
if(failed){console.error('PERFORMANCE_BUDGET_EXCEEDED');process.exit(1);}
