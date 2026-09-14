import assert from "node:assert/strict";

// Helpers for the Browser skill's tab.playwright API only. This module never
// launches a browser, reads credentials, or connects to an external target.
export const viewports = [
  {width:951,height:535}, {width:1103,height:621},
  {width:1366,height:768}, {width:390,height:844},
];

export async function calibrateViewport(tab, viewportCapability, target) {
  let outer = {...target};
  const attempts = [];
  for (let attempt=0;attempt<8;attempt++) {
    await viewportCapability.set(outer);
    const actual = await tab.playwright.evaluate(()=>({width:window.innerWidth,height:window.innerHeight}));
    attempts.push({outer:{...outer},actual});
    if (actual.width===target.width && actual.height===target.height) return attempts;
    outer = {
      width:Math.max(1,Math.round(outer.width*target.width/actual.width)),
      height:Math.max(1,Math.round(outer.height*target.height/actual.height)),
    };
  }
  assert.fail("Could not calibrate exact CSS viewport: "+JSON.stringify(attempts));
}

export function measureLayout() {
  const box = element => element?.getBoundingClientRect().toJSON() ?? null;
  const visible = element => element.getClientRects().length && getComputedStyle(element).display!=="none";
  const pick = selector => [...document.querySelectorAll(selector)].filter(visible).map(element=>({
    name:element.id||element.getAttribute("title")||element.textContent.trim().slice(0,80),box:box(element),
  }));
  const intersects = (a,b) => a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1
    &&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
  const contains = (outer,inner) => inner.left>=outer.left-1&&inner.right<=outer.right+1
    &&inner.top>=outer.top-1&&inner.bottom<=outer.bottom+1;
  const header = box(document.querySelector(".reference-topbar"));
  const menu = box(document.querySelector("#mainNavigation"));
  const brand = box(document.querySelector("#mainNavigation .industrial-sidebar-brand"));
  const footer = box(document.querySelector("#mainNavigation footer"));
  const scroller = document.querySelector("#mainNavigation .industrial-sidebar-scroll");
  const scrollArea = box(scroller);
  const adminElement = document.querySelector(".nav-admin-group>summary");
  const admin = box(adminElement);
  const workspaceElement = document.querySelector(".workspace");
  const workspace = box(workspaceElement);
  const qaElement = document.querySelector("#preventiveQa");
  const qa = qaElement&&!qaElement.hidden ? box(qaElement):null;
  const content = box(document.querySelector("#preventivePlans"));
  const controls = qa ? pick("#preventiveQa button"):[];
  const menuItems = pick(".nav-pinned .tab,.nav-group>summary");
  const overlaps = [];
  const regions = {header,menu,workspace,qa,content,brand,footer,scrollArea};
  for (const [a,b] of [["header","menu"],["header","workspace"],["menu","workspace"],["qa","content"],["brand","scrollArea"],["footer","scrollArea"]]) {
    if (intersects(regions[a],regions[b])) overlaps.push(a+"/"+b);
  }
  for (const entries of [controls,menuItems]) for (let i=0;i<entries.length;i++) for (let j=i+1;j<entries.length;j++) {
    if (intersects(entries[i].box,entries[j].box)) overlaps.push(entries[i].name+"/"+entries[j].name);
  }
  for (const entry of controls) if (!contains(qa,entry.box)) overlaps.push("QA control outside panel: "+entry.name);
  for (const summary of document.querySelectorAll(".nav-group>summary")) {
    const bounds=box(summary),label=box(summary.children[1]),chevron=box(summary.children[2]);
    if (!contains(bounds,label)||!contains(bounds,chevron)||intersects(label,chevron)) overlaps.push("menu tracks: "+summary.title);
  }
  const horizontal = [document.documentElement,workspaceElement,scroller,qa?qaElement:null].filter(Boolean)
    .filter(element=>element.scrollWidth>element.clientWidth+1)
    .map(element=>({name:element.id||element.className||element.tagName,width:element.clientWidth,scrollWidth:element.scrollWidth}));
  return {viewport:{width:innerWidth,height:innerHeight},header,menu,brand,footer,scrollArea,workspace,qa,content,controls,admin,
    adminVisible:contains(scrollArea,admin),adminFocused:document.activeElement===adminElement,
    adminOpen:document.querySelector(".nav-admin-group").open,
    scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,
    overflowY:getComputedStyle(scroller).overflowY,minHeight:getComputedStyle(scroller).minHeight,
    workspaceScroll:workspaceElement.scrollTop,overlaps,horizontal};
}

export async function checkLayout(tab, target, requireAdminVisible=false) {
  const result = await tab.playwright.evaluate(measureLayout);
  assert.equal(result.viewport.width,target.width,"CSS viewport width must be exact");
  assert.equal(result.viewport.height,target.height,"CSS viewport height must be exact");
  assert.equal(result.overlaps.length,0,"Overlapping layout elements: "+JSON.stringify(result.overlaps));
  assert.equal(result.horizontal.length,0,"Horizontal overflow: "+JSON.stringify(result.horizontal));
  assert.equal(result.overflowY,"auto");
  assert.equal(result.minHeight,"0px");
  assert.ok(result.footer.height>0,"Menu footer must remain visible");
  if (requireAdminVisible) assert.equal(result.adminVisible,true,"Admin must be completely inside navigation");
  return result;
}

export async function checkMenuAccess(tab,target) {
  const before=await checkLayout(tab,target);
  const axState=await tab.ax.get("state",{disableDiffing:true});
  const match=axState.match(/(\d+) container Módulos do GestMan365/);
  assert.ok(match,"Navigation must be exposed in the accessibility tree");
  await tab.ax.scroll(Number(match[1]),"down",20);
  // The accessibility snapshot waits for the UI after smooth scrolling before
  // we read geometry. A measurement taken during animation is not a verdict.
  await tab.ax.get();
  const scrolled=await checkLayout(tab,target,true);
  assert.equal(scrolled.workspaceScroll,before.workspaceScroll,"Menu scroll moved content");
  if(scrolled.scrollHeight>scrolled.clientHeight+1)assert.ok(scrolled.scrollTop>0);
  for(const key of ["header","brand","footer","workspace"])
    assert.equal(JSON.stringify(scrolled[key]),JSON.stringify(before[key]),key+" moved with navigation");
  await tab.playwright.locator(".nav-admin-group>summary").click();
  const clicked=await checkLayout(tab,target,true);
  assert.equal(clicked.adminFocused,true,"Admin did not receive focus");
  assert.equal(clicked.adminOpen,true,"Admin did not open after click");
  await tab.playwright.locator(".nav-admin-group>summary").click();
  await tab.playwright.locator("#qaHidePanel").click();
  const hidden=await checkLayout(tab,target,true);
  assert.equal(hidden.qa,null);
  for(const key of ["header","menu","brand","footer","scrollArea","admin"])
    assert.equal(JSON.stringify(hidden[key]),JSON.stringify(scrolled[key]),"QA changed "+key);
  await tab.reload();
  return {before,scrolled,clicked,hidden};
}

export async function checkTypography(tab) {
  const result = await tab.playwright.evaluate(()=>{
    const elements=[...document.querySelectorAll("h1,h2,p,label,button,input,select,th,td")].filter(element=>element.getClientRects().length);
    const broken=[];
    for(const parent of [document.body,...document.body.querySelectorAll("*")]) {
      if(["SCRIPT","STYLE","NOSCRIPT"].includes(parent.tagName))continue;
      for(const node of parent.childNodes) {
        if(node.nodeType===3&&/ADMINISTRAÃ|Ãšlt|Ã—|â€”|â€¦|\uFFFD/.test(node.textContent||""))broken.push(node.textContent.trim().slice(0,160));
      }
    }
    const families=[...new Set([...document.body.querySelectorAll("*")]
      .filter(element=>!["SCRIPT","STYLE","NOSCRIPT"].includes(element.tagName))
      .map(element=>getComputedStyle(element).fontFamily))];
    return {
      interLoaded:document.fonts.check('16px "Inter"'),
      broken,
      nonInter:elements.filter(element=>!/^Inter(?:,|$)/i.test(getComputedStyle(element).fontFamily)).map(element=>element.tagName),
      nonApprovedFontFamilies:families.filter(font=>!/^(?:Inter|"?Cascadia Mono"?|Consolas)(?:,|$)/i.test(font)),
      overflowingText:[...document.querySelectorAll(".auth-footer-copy,h1,h2,label")]
        .filter(element=>element.getClientRects().length&&element.scrollWidth>element.clientWidth+1)
        .map(element=>element.textContent.trim().slice(0,120)),
    };
  });
  assert.equal(result.interLoaded,true);
  assert.equal(result.broken.length,0,JSON.stringify(result.broken));
  assert.equal(result.nonInter.length,0,JSON.stringify(result.nonInter));
  assert.equal(result.nonApprovedFontFamilies.length,0,JSON.stringify(result.nonApprovedFontFamilies));
  assert.equal(result.overflowingText.length,0,JSON.stringify(result.overflowingText));
  return result;
}

export async function runPreventiveScenarios(tab) {
  const page=tab.playwright;
  const status=()=>page.locator("#qaStatus").innerText();
  const message=()=>page.locator("#qaMessage").innerText();
  const reset=()=>page.locator("#qaReset").click();
  const modal=page.locator("#genericModalBox");
  const cancel=()=>modal.getByRole("button",{name:"Cancelar",exact:true}).click();
  const generate=()=>page.locator("#qaGenerate").click();
  const confirm=()=>modal.getByRole("button",{name:"Gerar O.S.",exact:true}).click();
  const results=[];
  await reset();
  const original=await status();
  await generate();
  assert.match(await modal.innerText(),/Duração prevista: 1 h/);
  const modalLayout=await modal.evaluate(element=>({box:element.getBoundingClientRect().toJSON(),width:innerWidth,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth}));
  assert.ok(modalLayout.box.left>=0&&modalLayout.box.right<=modalLayout.width+1);
  assert.ok(modalLayout.scrollWidth<=modalLayout.clientWidth+1);
  await cancel();
  assert.equal(await status(),original);
  results.push("cancelamento sem alteração");
  await page.locator("#qaPause").click();
  const paused=await status();
  await generate();
  assert.equal(await status(),paused);
  assert.equal(await message(),"Reative o plano antes de gerar uma O.S.");
  results.push("plano pausado bloqueado");
  await reset();
  await page.locator("#qaFailure").click();
  const failed=await status();
  await generate();
  await confirm();
  assert.equal(await status(),failed);
  assert.match(await message(),/A O.S. não foi criada/);
  await cancel();
  results.push("falha com rollback de O.S., data e evento");
  await reset();
  await page.locator("#qaDoubleSubmit").click();
  assert.match(await status(),/O.S.: 1 \| Próxima execução: 2026-10-09 \| Eventos: 1/);
  assert.match(await message(),/criada com responsável/);
  assert.equal(await page.locator("#preventiveDetailPanel .preventive-info-grid strong").filter({hasText:/^1 h$/}).innerText(),"1 h");
  results.push("envio duplo: uma O.S. e um evento","duração 1 h no modal e no detalhe");
  return {results,status:await status(),modalLayout};
}
