import { expect, test } from "@playwright/test";

for (const theme of ["dark", "light"]) {
  for (const viewport of [{width:1366,height:768}, {width:1103,height:621}, {width:951,height:535}, {width:390,height:844}]) {
    test(`listagens Ativos/Preventivas — ${theme} ${viewport.width}`, async ({ page }, testInfo) => {
      test.setTimeout(60000);
      await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
      await page.setViewportSize(viewport);
      await page.goto("./");
      await page.evaluate(theme => {
        document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
        window.eval(`
          currentAccount = {user:{id:"ui-audit-admin",name:"Auditor visual",role:"admin",accessProfile:"admin",active:true},company:{id:"ui-audit-company",name:"QA visual"}};
          createDemoDataSet();
          const assetBase = {...state.assets[0]};
          const planBase = {...state.preventivePlans[0]};
          state.assets = Array.from({length:12}, (_,i)=>({...assetBase,id:"list-asset-"+i,code:"QA-AT-"+String(i+1).padStart(3,"0"),name:"Conjunto hidráulico industrial "+(i+1)+" — inspeção de componentes e segurança",status:i%2?"Em manutenção":"Operando",criticality:i%2?"Alta":"Baixa"}));
          state.preventivePlans = Array.from({length:12}, (_,i)=>({...planBase,id:"list-plan-"+i,name:"QA-PM-"+String(i+1).padStart(3,"0")+" · Inspeção preventiva do conjunto hidráulico",assetId:state.assets[i].id,status:i%2?"Pausado":"Ativo",nextExecution:"2099-10-30",durationHours:1}));
          applyTheme("${theme}",{silent:true});
        `);
      }, theme);
      for (const kind of ["assets", "preventivePlans"]) {
        const asset = kind === "assets";
        const count = page.locator(asset ? "#assetResultCount" : "#preventiveResultCount");
        const panel = page.locator(asset ? "#assetFilterPanel" : "#preventiveFilterPanel");
        const search = page.locator(asset ? "#assetWorkspaceSearch" : "#preventiveSearch");
        const status = page.locator(asset ? "#assetStatusFilter" : "#preventiveStatusFilter");
        const list = page.locator(viewport.width <= 1024 ? (asset ? "#assetMobileList" : "#preventiveMobileList") : (asset ? "#assetRows" : "#preventivePlanRows"));
        await page.evaluate(kind => {
          window.eval(`setView("${kind}",{persist:false,route:false})`);
          document.querySelectorAll("section.view").forEach(view => view.classList.remove("active"));
          document.getElementById(kind)?.classList.add("active");
          window.eval(kind === "assets" ? "renderAssetsWorkspace()" : "renderPreventivePlansWorkspace()");
          window.eval("standardizeUiComponents(document)");
        }, kind);
        const before = await page.evaluate(() => window.eval("JSON.stringify([state.assets,state.preventivePlans,state.orders])"));
        await expect(count).toHaveText(asset ? "12 ativos" : "12 planos");
        if (!(await search.isVisible())) {
          const toggle = page.locator(asset ? "#assetFilterToggle" : '#preventivePlans button[onclick="togglePreventiveFilters()"]');
          await toggle.scrollIntoViewIfNeeded();
          await toggle.click();
        }
        await expect(status.locator("..")).toContainText(asset ? "Status" : "Status do plano");
        await status.selectOption(asset ? "Operando" : "Pausado");
        await expect(count).toHaveText(asset ? "6 ativos" : "6 planos");
        await search.fill("inexistente-qa");
        await expect(count).toHaveText(asset ? "0 ativos" : "0 planos");
        await expect(list).toContainText(asset ? "Nenhum equipamento encontrado" : "Nenhum plano encontrado");
        await panel.getByRole("button", {name:"Limpar filtros"}).click();
        await expect(count).toHaveText(asset ? "12 ativos" : "12 planos");
        if (!(await search.isVisible())) {
          const toggle = page.locator(asset ? "#assetFilterToggle" : '#preventivePlans button[onclick="togglePreventiveFilters()"]');
          await toggle.scrollIntoViewIfNeeded();
          await toggle.click();
        }
        await search.fill(asset ? "QA-AT-001" : "QA-PM-001");
        await expect(count).toHaveText(asset ? "1 ativo" : "1 plano");
        const details = list.locator(".gm-list-details").first();
        await details.scrollIntoViewIfNeeded();
        await details.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(details).toBeFocused();
        expect(await details.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe("solid");
        await details.press("Enter");
        await expect(page.locator(asset ? "#assetDetailPanel" : "#preventiveDetailPanel")).toBeVisible();
        await page.evaluate(asset => window.eval(asset ? "closeAssetDetail()" : "closePreventivePlanDetail()"),asset);
        expect(await page.evaluate(()=>window.eval("JSON.stringify([state.assets,state.preventivePlans,state.orders])"))).toBe(before);
        await panel.getByRole("button", {name:"Limpar filtros"}).click();
        const pagination = page.locator(asset ? "#assetPagination" : "#preventivePagination");
        await pagination.getByRole("button", {name:"2",exact:true}).click();
        await expect(pagination.getByRole("button", {name:"2",exact:true})).toHaveClass(/active/);
        await pagination.getByRole("button", {name:"1",exact:true}).click();
        await list.locator(".gm-list-details").first().scrollIntoViewIfNeeded();
        const geometry = await page.evaluate(kind => {
          const view = document.getElementById(kind)!;
          const workspace=document.querySelector(".workspace")!;
          const cards=Array.from(view.querySelectorAll(".asset-mobile-card,.preventive-mobile-card"));
          return {width:innerWidth, height:innerHeight, page:document.documentElement.scrollWidth, workspace:workspace.clientWidth, scroll:workspace.scrollWidth, clipped:cards.filter(card=>{const r=card.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth);}).length};
        },kind);
        expect(geometry.width).toBe(viewport.width);
        expect(geometry.height).toBe(viewport.height);
        expect(geometry.page).toBeLessThanOrEqual(geometry.width+1);
        expect(geometry.scroll).toBeLessThanOrEqual(geometry.workspace+1);
        expect(geometry.clipped).toBe(0);
        await page.screenshot({path:testInfo.outputPath(kind+".png")});
      }
    });
  }
}
