import { expect, test } from "@playwright/test";

test("identidade GestMan carrega no login e nos ícones do app", async ({ page, request }, testInfo) => {
  await page.goto("./");
  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveCount(1);
  const manifestUrl = await manifest.getAttribute("href");
  expect(manifestUrl).toContain("assets/brand/manifest.webmanifest");

  for (const path of [
    "assets/brand/gestman-symbol.svg",
    "assets/brand/gestman-logo-on-light.svg",
    "assets/brand/gestman-logo-on-dark.svg",
    "assets/brand/gestman-icon-192.png",
    "assets/brand/gestman-icon-512.png",
    "assets/brand/gestman-apple-touch.png",
    "assets/brand/favicon.ico",
  ]) {
    const response = await request.get(new URL(path, page.url()).href);
    expect(response.ok(), `${path} deve estar disponível`).toBe(true);
  }

  const manifestResponse = await request.get(manifestUrl!);
  const appManifest = await manifestResponse.json();
  expect(appManifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(["192x192", "512x512"]);
  const logo = page.locator(".auth-card-logo-wrap .auth-logo-img");
  await expect(logo).toHaveAttribute("data-theme-logo", "");
  await expect(logo).toHaveJSProperty("complete", true);
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  expect(await logo.evaluate(image => getComputedStyle(image).content)).toContain("gestman-logo-on-dark.svg");
  await page.locator("body").evaluate(body => body.classList.add("theme-light"));
  expect(await logo.evaluate(image => getComputedStyle(image).content)).toContain("gestman-logo-on-light.svg");
  await page.locator("body").evaluate(body => body.classList.remove("theme-light"));

  for (const [label, width, height] of [["desktop", 1440, 900], ["tablet", 820, 1180], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: testInfo.outputPath(`gestman-login-${label}.png`) });
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
});
