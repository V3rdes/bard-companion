// Entrada de transición: evita las URL congeladas en cachés de versiones anteriores.
// La app vuelve a la URL normal al arrancar y usa después su actualización automática.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const version = /CACHE_PREFIX \+ 'v(\d+)'/.exec(worker)?.[1];
if (!version) throw new Error('No se encontró la versión de caché.');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/src="(\.\/src\/[^"?]+)"/g, 'src="$1?app=' + version + '"')
  .replace('href="./src/styles.css"', 'href="./src/styles.css?app=' + version + '"');
fs.writeFileSync(path.join(root, 'abrir.html'), html);
