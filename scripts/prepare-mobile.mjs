import { mkdir, copyFile } from 'node:fs/promises';

// Keep the native WebView bundle identical to the deployed web application.
// The HTML loads both cloud modules, so they must exist inside Capacitor's www directory.
const files = [
  'index.html',
  'app.js',
  'supabase-config.js',
  'cloud-sync.js',
  'extras.js',
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
];

await mkdir('www', { recursive: true });
for (const file of files) await copyFile(file, 'www/' + file);
console.log(`Arquivos web preparados para Android e iOS (${files.length} arquivos).`);
