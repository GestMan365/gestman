// Injected only by the local QA server. It never ships with the application.
window.addEventListener("load", () => {
  currentAccount = {
    company: { id:"phase05-ui-local", name:"Empresa fictícia de auditoria", remoteSync:false },
    user: { id:"phase05-auditor", name:"Auditoria visual", role:"admin", accessProfile:"admin", active:true },
  };
  state = normalizeState(emptyState());
  state.profile = { name:"Auditoria visual" };

  // Keep the audit hermetic: generated fixture data lives only in this page.
  saveState = () => {};
  persistDemoStateLocalOnly = () => {};
  saveOrderSupabaseNow = async () => false;
  createDemoDataSet();

  document.body.dataset.phase05Qa = "true";
  document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
  closeModal();
  render();
  setView("dashboard");
});
