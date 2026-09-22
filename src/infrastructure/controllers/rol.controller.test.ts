import assert from "node:assert/strict";
import test from "node:test";
import { RolService } from "../../applications/services/rol.service";
import { RolController } from "./rol.controller";

const respuesta = () => {
  const estado: any = {};
  const res: any = {
    status(codigo: number) { estado.status = codigo; return res; },
    json(body: any) { estado.body = body; return res; },
  };
  return { res, estado };
};

test("RolController conserva códigos y payloads del contrato", async (t) => {
  const rol = { idRol: 4, nombre: "Operaciones" } as any;
  t.mock.method(RolService.prototype, "crearRol", async () => rol);
  t.mock.method(RolService.prototype, "listarRoles", async () => ({ data: [rol] }) as any);
  t.mock.method(RolService.prototype, "buscarPorNombre", async () => [rol] as any);
  t.mock.method(RolService.prototype, "actualizarRol", async () => rol);
  t.mock.method(RolService.prototype, "desactivarRol", async () => rol);
  t.mock.method(RolService.prototype, "eliminarRol", async () => rol);
  t.mock.method(
    RolService.prototype,
    "obtenerImpactoEliminacion",
    async () => ({ puedeEliminar: true }) as any,
  );
  const controller = new RolController();
  const req: any = {
    body: { nombre: "Operaciones" },
    query: { nombre: "Opera" },
    params: { id: "4" },
  };

  for (const [metodo, codigo] of [
    ["crearRol", 201], ["listarRoles", 200], ["buscarPorNombre", 200],
    ["actualizarRol", 200], ["desactivarRol", 200], ["eliminarRol", 200],
    ["obtenerImpactoEliminacion", 200],
  ] as const) {
    const { res, estado } = respuesta();
    await (controller[metodo] as any)(req, res);
    assert.equal(estado.status, codigo);
    assert.ok(estado.body.data);
  }
});
