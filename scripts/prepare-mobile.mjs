import { mkdir, copyFile } from 'node:fs/promises';

const files = [
  'index.html',
  'app.js',
  'extras.js',
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
];
await mkdir('www', { recursive: true });
for (const file of files) await copyFile(file, 'www/' + file);
console.log('Arquivos web preparados para Android e iOS.');
