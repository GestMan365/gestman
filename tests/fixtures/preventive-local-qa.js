// Injected only by serve-preventive-local-qa.mjs; never imported by the app.
window.addEventListener("load", () => {
  let failSave = false;
  const panel = document.createElement("section");
  panel.id = "preventiveQa";
  panel.innerHTML = '<h2>QA local — dados fictícios, sem conexão externa</h2><div class="qa-controls"><button id="qaReset" class="btn">Reiniciar cenário</button><button id="qaPause" class="btn">Pausar plano</button><button id="qaFailure" class="btn">Simular falha</button><button id="qaGenerate" class="btn primary">Testar geração</button></div><p id="qaStatus" role="status"></p><p id="qaMessage" role="status"></p>';
  const style = document.createElement("style");
  style.textContent = `
    #preventiveQa { position:relative; padding:16px; margin:0 0 16px; background:#152136; color:#fff; border:1px solid #315878; border-radius:8px; min-width:0; }
    #preventiveQa h2 { margin:0 0 12px; font-size:16px; line-height:1.4; }
    #preventiveQa .qa-controls { display:flex; flex-wrap:wrap; gap:8px; }
    #preventiveQa .btn { max-width:100%; white-space:normal; }
    #preventiveQa p { overflow-wrap:anywhere; margin:12px 0 0; }
    #preventiveQa p:empty { display:none; }
  `;
  document.head.append(style);
  // The app has a fixed scrolling workspace. QA must participate in its flow,
  // not compete with the fixed production menu/header from the body root.
  document.querySelector(".workspace").prepend(panel);
  const doubleSubmit = document.createElement("button");
  doubleSubmit.id = "qaDoubleSubmit";
  doubleSubmit.className = "btn";
  doubleSubmit.textContent = "Testar envio duplo";
  const hidePanel = document.createElement("button");
  hidePanel.id = "qaHidePanel";
  hidePanel.className = "btn";
  hidePanel.textContent = "Ocultar painel QA";
  panel.querySelector(".qa-controls").append(doubleSubmit, hidePanel);
  hidePanel.onclick = () => { panel.hidden = true; };
  doubleSubmit.onclick = () => {
    generatePreventivePlanOrder("qa-plan");
    const button = document.querySelector('#genericBody button[onclick^="confirmGeneratePreventivePlanOrder"]');
    if (!button) return;
    button.click();
    button.click();
  };
  const update = () => {
    const plan = state.preventivePlans[0];
    document.getElementById("qaStatus").textContent = `O.S.: ${state.orders.length} | Próxima execução: ${plan.nextExecution} | Eventos: ${plan.history.length} | Plano: ${plan.status} | Persistência: ${failSave ? "falha simulada" : "memória"}`;
  };
  const reset = () => {
    currentAccount = {company:{id:"qa-local",name:"Empresa fictícia",remoteSync:false},user:{id:"qa-planner",name:"Planejador fictício",role:"admin",accessProfile:"admin",active:true}};
    state = normalizeState(emptyState());
    state.profile = {name:"Planejador fictício"};
    state.assets = [{id:"qa-asset",code:"QA-001",name:"Bomba de teste",status:"Operando"}];
    state.resources = [{id:"qa-tech",name:"Técnico fictício",code:"QA-TEC",status:"Disponível",type:"Terceirizado"}];
    state.checklists = [{id:"qa-check",name:"Inspeção fictícia",status:"Ativo",items:[]}];
    state.preventivePlans = [{id:"qa-plan",companyId:"qa-local",name:"Preventiva de teste local",description:"Inspeção sem dados reais",assetId:"qa-asset",status:"Ativo",nextExecution:"2026-09-09",frequencyPreset:"monthly",intervalDays:30,responsibleId:"qa-tech",responsibleName:"Técnico fictício",executorIds:["qa-tech"],durationHours:1,checklistId:"qa-check",history:[],plannedParts:[],documents:[]}];
    failSave = false;
    closePreventivePlanDetail();
    document.body.classList.remove("auth-required","auth-loading","auth-restoring");
    document.querySelectorAll(".view").forEach(view => view.classList.toggle("active",view.id === "preventivePlans"));
    closeModal();
    renderPreventivePlansWorkspace();
    document.getElementById("qaMessage").textContent = "";
    update();
  };
  // Only the persistence boundary is simulated; generation and modal code are original.
  saveState = () => update();
  saveOrderSupabaseNow = async () => !failSave;
  render = () => { renderPreventivePlansWorkspace(); update(); };
  showToast = message => { document.getElementById("qaMessage").textContent = message; update(); };
  panel.querySelector("#qaReset").onclick = reset;
  panel.querySelector("#qaPause").onclick = () => { state.preventivePlans[0].status = "Pausado"; render(); };
  panel.querySelector("#qaFailure").onclick = () => { failSave = true; update(); };
  panel.querySelector("#qaGenerate").onclick = () => generatePreventivePlanOrder("qa-plan");
  reset();
});
