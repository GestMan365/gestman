import test from "node:test";
import assert from "node:assert/strict";

const resourceUserId = (resource, directory) =>
  directory.find(user => user.resourceId === resource.id)?.userId || String(resource.userId || "");

const candidates = (resources, users) => {
  const rows = resources.filter(resource => {
    const userId = resourceUserId(resource, users);
    const user = users.find(item => item.userId === userId);
    return resource.status !== "Inativo" && (!userId || !user || user.active);
  }).map(resource => ({ id: resource.id, userId: resourceUserId(resource, users) }));
  users.filter(user => user.active && user.executor && !resources.some(resource => resourceUserId(resource, users) === user.userId))
    .forEach(user => rows.push({ id: `user:${user.userId}`, userId: user.userId }));
  return rows;
};

test("vínculo canônico prevalece sobre espelho legado", () => {
  assert.equal(resourceUserId({ id:"r1", userId:"legacy" }, [{ resourceId:"r1", userId:"canonical" }]), "canonical");
});

test("recurso e usuário vinculado não aparecem duplicados na O.S.", () => {
  const rows = candidates([{ id:"r1", status:"Disponível", userId:"u1" }], [{ userId:"u1", resourceId:"r1", active:true, executor:true }]);
  assert.deepEqual(rows, [{ id:"r1", userId:"u1" }]);
});

test("usuário executor sem recurso aparece imediatamente", () => {
  const rows = candidates([], [{ userId:"u2", resourceId:"", active:true, executor:true }]);
  assert.deepEqual(rows, [{ id:"user:u2", userId:"u2" }]);
});

test("acesso inativo bloqueia novas atribuições sem apagar recurso", () => {
  const resources = [{ id:"r1", status:"Disponível", userId:"u1" }];
  assert.deepEqual(candidates(resources, [{ userId:"u1", resourceId:"r1", active:false, executor:true }]), []);
  assert.equal(resources.length, 1);
});
