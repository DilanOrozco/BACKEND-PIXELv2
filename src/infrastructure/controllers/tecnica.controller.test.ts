import assert from "node:assert/strict";
import test from "node:test";
import { TecnicaService } from "../../applications/services/tecnica.service";
import { TecnicaController } from "./tecnica.controller";

const respuesta = () => {
  const estado: any = {};
  const res: any = {
    status(codigo: number) { estado.status = codigo; return res; },
    json(body: any) { estado.body = body; return res; },
  };
  return { res, estado };
};

test("TecnicaController mantiene contratos HTTP exitosos", async (t) => {
  const tecnica = { idTecnica: 3 } as any;
  t.mock.method(TecnicaService.prototype, "crearTecnica", async () => tecnica);
  t.mock.method(TecnicaService.prototype, "listarTecnicas", async () => ({ data: [tecnica] }) as any);
  t.mock.method(TecnicaService.prototype, "buscarPorId", async () => tecnica);
  t.mock.method(TecnicaService.prototype, "buscarParcial", async () => [tecnica] as any);
  t.mock.method(TecnicaService.prototype, "actualizarTecnica", async () => tecnica);
  t.mock.method(TecnicaService.prototype, "desactivarTecnica", async () => tecnica);
  t.mock.method(TecnicaService.prototype, "eliminarTecnica", async () => tecnica);
  const controller = new TecnicaController();
  const req: any = { body: {}, query: { termino: "DTF" }, params: { id: "3" } };

  for (const [metodo, codigo] of [
    ["crearTecnica", 201], ["listarTecnicas", 200], ["buscarPorId", 200],
    ["buscarParcial", 200], ["actualizarTecnica", 200], ["desactivarTecnica", 200],
    ["eliminarTecnica", 200],
  ] as const) {
    const { res, estado } = respuesta();
    await (controller[metodo] as any)(req, res);
    assert.equal(estado.status, codigo);
  }
});

test("TecnicaController conserva códigos de error", async (t) => {
  const fallo = async () => { throw new Error("técnica inválida"); };
  for (const metodo of [
    "crearTecnica", "listarTecnicas", "buscarPorId", "buscarParcial",
    "actualizarTecnica", "desactivarTecnica", "eliminarTecnica",
  ] as const) {
    t.mock.method(TecnicaService.prototype, metodo, fallo as any);
  }
  const controller = new TecnicaController();
  const req: any = { body: {}, query: {}, params: { id: "x" } };

  for (const [metodo, codigo] of [
    ["crearTecnica", 400], ["listarTecnicas", 404], ["buscarPorId", 404],
    ["buscarParcial", 404], ["actualizarTecnica", 400], ["desactivarTecnica", 404],
    ["eliminarTecnica", 400],
  ] as const) {
    const { res, estado } = respuesta();
    await (controller[metodo] as any)(req, res);
    assert.equal(estado.status, codigo);
    assert.equal(estado.body.message, "técnica inválida");
  }
});
