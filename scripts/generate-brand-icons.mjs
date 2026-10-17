import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.join(root, "assets", "brand");
const svg = await readFile(path.join(brand, "gestman-app-icon.svg"), "utf8");
const imageData = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const browser = await chromium.launch({ headless: true });

async function render(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0"><img alt="" width="${size}" height="${size}" src="${imageData}"></body></html>`);
  await page.locator("img").evaluate(image => image.decode());
  const png = await page.locator("img").screenshot();
  await page.close();
  return png;
}

try {
  for (const size of [16, 32, 48, 180, 192, 512]) {
    const png = await render(size);
    const name = size === 180 ? "gestman-apple-touch.png" : `gestman-icon-${size}.png`;
    await writeFile(path.join(brand, name), png);
  }
  const faviconSizes = [16, 32, 48];
  const images = await Promise.all(faviconSizes.map(size => readFile(path.join(brand, `gestman-icon-${size}.png`))));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (let index = 0; index < images.length; index++) {
    const position = 6 + index * 16;
    header.writeUInt8(faviconSizes[index], position);
    header.writeUInt8(faviconSizes[index], position + 1);
    header.writeUInt16LE(1, position + 4);
    header.writeUInt16LE(32, position + 6);
    header.writeUInt32LE(images[index].length, position + 8);
    header.writeUInt32LE(offset, position + 12);
    offset += images[index].length;
  }
  await writeFile(path.join(brand, "favicon.ico"), Buffer.concat([header, ...images]));
} finally {
  await browser.close();
}
