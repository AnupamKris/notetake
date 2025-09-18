import Jimp from 'jimp';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const srcPath = resolve(__dirname, '..', 'src', 'logo.png');
  const outPath = resolve(__dirname, '..', 'src-tauri', 'icon.png');

  const img = await Jimp.read(srcPath);
  const size = Math.max(img.getWidth(), img.getHeight());
  const square = new Jimp({ width: size, height: size, color: 0x00000000 });
  const x = Math.floor((size - img.getWidth()) / 2);
  const y = Math.floor((size - img.getHeight()) / 2);
  square.composite(img, x, y);

  await square.write(outPath);
  console.log('Wrote', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
