import {expect,test} from "@playwright/test";
test("cronograma anual mostra estados e detalhes sem escrita nos quatro tamanhos",async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("https://**/*",route=>route.abort());
  await page.goto("./");
  await page.evaluate(()=>window.eval(`
    document.body.classList.remove("auth-required","auth-loading","auth-restoring");
    currentAccount={user:{id:"qa",name:"QA",role:"admin",accessProfile:"admin",active:true},company:{id:"qa",name:"QA"}};
    createDemoDataSet();
    state.assets=[{id:"a",code:"MAQ-01",name:"Máquina QA",status:"Operando"}];
    state.preventivePlans=[{id:"p",assetId:"a",name:"Lubrificação QA",nextExecution:"2026-01-01",intervalDays:30,frequencyPreset:"monthly",status:"Ativo"}];
    state.orders=[{id:"os",number:"OS-QA",assetId:"a",preventivePlanId:"p",scheduledAt:"2026-01-01T08:00",status:"Concluída"}];
    window.qaWrites=0;saveState=()=>{window.qaWrites++};
    setView("preventivePlans",{persist:false,route:false});renderPreventivePlansWorkspace();
  `));
  await page.locator("#gmPreventiveYearPanel > summary").click();
  await page.locator("#gmPreventiveYear").selectOption("2026");
  await expect(page.locator(".gm-year-mark.done")).toHaveCount(1);
  await expect(page.locator(".gm-year-mark.late").first()).toBeVisible();
  await expect(page.locator(".gm-year-mark.future").first()).toBeAttached();
  for(const size of [{width:1366,height:768},{width:1103,height:621},{width:951,height:535},{width:390,height:844}]){
    await page.setViewportSize(size);
    for(const light of [false,true]){
      await page.evaluate(light=>document.body.classList.toggle("theme-light",light),light);
      const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth}));
      expect(geometry.width).toBe(size.width);expect(geometry.height).toBe(size.height);
      expect(geometry.scroll).toBeLessThanOrEqual(size.width+1);
      await expect(page.locator("#gmPreventiveYearTable thead th")).toHaveCount(54);
      const columns=await page.locator("#gmPreventiveYearTable thead th").evaluateAll(nodes=>nodes.slice(1,4).map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
      expect(columns[0].y).toBe(columns[1].y);
      expect(columns[1].x).toBeGreaterThan(columns[0].x);
      for(const [state,color] of [["done","rgb(22, 101, 52)"],["late","rgb(153, 27, 27)"],["future","rgb(30, 64, 175)"]]){
        await expect(page.locator(".gm-year-mark."+state).first()).toHaveCSS("background-color",color);
      }
      await page.locator("#gmPreventiveYearScroll").scrollIntoViewIfNeeded();
      if(size.width===1366||size.width===390)await page.screenshot({path:`test-results/preventive-year-${size.width}-${light?"light":"dark"}.png`});
    }
  }
  await page.locator(".gm-year-mark.done").click();
  await expect(page.getByText("O.S. OS-QA", {exact:false})).toBeVisible();
  await page.evaluate(()=>window.eval("closeModal()"));
  await page.locator("#gmPreventiveYearSearch").fill("inexistente");
  await expect(page.locator("#gmPreventiveYearTable")).toContainText("Nenhuma máquina encontrada");
  expect(await page.evaluate(()=>window.eval("window.qaWrites"))).toBe(0);
  expect(errors).toEqual([]);
});
