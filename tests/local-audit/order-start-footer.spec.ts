import { expect, test } from "@playwright/test";

test("iniciar O.S. aparece uma vez no final do formulário sem flutuar", async ({ page }) => {
  await page.route("https://**/*", route => route.abort());
  await page.goto("./");
  await page.evaluate(() => window.eval(`
    document.body.classList.remove("auth-required","auth-loading","auth-restoring");
    currentAccount={user:{id:"qa",name:"QA",role:"admin",accessProfile:"admin",active:true},company:{id:"qa",name:"QA"}};
    createDemoDataSet();
    state.orders[0].status="Aberta";
    showOrderDetails(state.orders[0].id);
  `));
  for (const size of [{width:1366,height:768},{width:390,height:844}]) {
    await page.setViewportSize(size);
    const button = page.locator('#orderDetailForm [data-order-primary-action="start"]');
    await expect(button).toHaveCount(1);
    await expect(page.locator('#orderDetailForm [data-order-state="ready"]')).toHaveCount(0);
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    const layout = await button.evaluate(element => {
      const footer = element.closest('.order-start-footer')!;
      const fields = document.querySelector('#orderDetailForm .detail-grid')!;
      return { position:getComputedStyle(footer).position, buttonPosition:getComputedStyle(element).position, after:!!(fields.compareDocumentPosition(footer)&Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    expect(layout).toEqual({position:"static",buttonPosition:"static",after:true});
  }
});
