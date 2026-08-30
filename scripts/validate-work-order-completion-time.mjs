import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const fallback = read("404.html");
const failures = [];
const expect = (condition,message) => { if (!condition) failures.push(message); };
const functionBody = name => {
  const syncStart=html.indexOf(`function ${name}(`),asyncStart=html.indexOf(`async function ${name}(`);
  const start=asyncStart>=0&&(syncStart<0||asyncStart<syncStart)?asyncStart:syncStart;
  if(start<0)return "";
  const boundaries=["\n    function ","\n    async function ","\n    const "].map(marker=>html.indexOf(marker,start+12)).filter(index=>index>=0);
  const next=boundaries.length?Math.min(...boundaries):-1;
  return html.slice(start,next<0?html.length:next);
};

const simpleFinish=functionBody("openSimpleFinishOrderModal");
const detailedFinish=functionBody("openFinishOrderModal");
const service=functionBody("gmTransitionWorkOrder");
const normalize=functionBody("gmNormalizeOrderCompletionTime");
const messages=functionBody("gmOrderTransitionErrorMessage");

expect(simpleFinish.includes('id="simpleFinishAt" type="datetime-local" step="1"'),"Conclusão simples não habilita segundos com step=1.");
expect(simpleFinish.includes("localDateTimeSecondsValue()"),"Conclusão simples não é preenchida com segundos.");
expect(simpleFinish.includes("gmNormalizeOrderCompletionTime"),"Formulário não usa a normalização temporal compartilhada.");
expect(simpleFinish.includes("button.disabled = false"),"Botão simples não é reabilitado após falha remota.");
expect(detailedFinish.includes("finally { if (button) button.disabled = false; }"),"Botão do encerramento detalhado não é reabilitado após erro.");
expect(normalize.includes("Math.floor(finishedAt/1000) === Math.floor(startedAt/1000)"),"Mesmo segundo não é normalizado com segurança.");
expect(normalize.includes('throw new Error("GM_ORDER_INTERVAL_INVALID")'),"Conclusão anterior não é bloqueada no serviço.");
expect(normalize.includes('throw new Error("GM_ORDER_COMPLETION_FUTURE")'),"Conclusão futura não é bloqueada no serviço.");
expect(service.indexOf("gmPrepareWorkOrderTransitionPatch")<service.indexOf("clearTimeout"),"Validação ocorre depois de efeitos colaterais do serviço.");
expect(service.includes('["Concluída","Cancelada"].includes(targetStatus)'),"Replay de encerramento não é bloqueado antes do RPC.");
expect(messages.includes("GM_ORDER_COMPLETION_TIME_INVALID")&&messages.includes("GM_ORDER_COMPLETION_FUTURE"),"Mensagens específicas de data de conclusão estão ausentes.");
expect(html.includes('return "CHECKLIST_CONCLUIDO"')&&html.includes('return "CONCLUSAO"'),"Auditoria de checklist e conclusão da O.S. não permanece separada.");
expect(html===fallback,"index.html e 404.html não estão sincronizados.");

if(failures.length){console.error(failures.map(item=>`- ${item}`).join("\n"));process.exit(1)}
console.log("Conclusão de O.S. com precisão de segundos: validação estática aprovada.");
