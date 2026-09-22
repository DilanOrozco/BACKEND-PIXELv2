import assert from "node:assert/strict";
import test from "node:test";
import { ProveedorService } from "../../applications/services/proveedor.service";
import { ProveedorController } from "./proveedor.controller";

const crearRespuesta = () => {
  const estado: { status?: number; body?: any } = {};
  const response = {
    status(status: number) {
      estado.status = status;
      return response;
    },
    json(body: any) {
      estado.body = body;
      return response;
    },
  };
  return { response: response as any, estado };
};

test("ProveedorController conserva contratos HTTP exitosos", async (t) => {
  const proveedor = { idProveedor: 7 } as any;
  t.mock.method(ProveedorService.prototype, "crearProveedor", async () => proveedor);
  t.mock.method(
    ProveedorService.prototype,
    "listarProveedores",
    async () => ({ data: [proveedor] }) as any,
  );
  t.mock.method(ProveedorService.prototype, "buscarPorId", async () => proveedor);
  t.mock.method(ProveedorService.prototype, "buscarParcial", async () => [proveedor] as any);
  t.mock.method(ProveedorService.prototype, "actualizarProveedor", async () => proveedor);
  t.mock.method(ProveedorService.prototype, "desactivarProveedor", async () => proveedor);
  t.mock.method(ProveedorService.prototype, "eliminarProveedor", async () => proveedor);
  const controller = new ProveedorController();
  const req = {
    body: { nombre: "Proveedor" },
    query: { termino: "Prov" },
    params: { id: "7" },
  } as any;

  for (const [metodo, status, mensaje] of [
    ["crearProveedor", 201, "Proveedor creado correctamente."],
    ["listarProveedores", 200, undefined],
    ["buscarPorId", 200, undefined],
    ["buscarParcial", 200, undefined],
    ["actualizarProveedor", 200, "Proveedor actualizado correctamente."],
    ["desactivarProveedor", 200, "Proveedor desactivado correctamente."],
    ["eliminarProveedor", 200, "Proveedor eliminado correctamente."],
  ] as const) {
    const { response, estado } = crearRespuesta();
    await (controller[metodo] as any)(req, response);
    assert.equal(estado.status, status);
    if (mensaje) assert.equal(estado.body.message, mensaje);
  }
});

test("ProveedorController conserva códigos de error y fallback seguro", async (t) => {
  const fallo = async () => {
    throw new Error("fallo controlado");
  };
  t.mock.method(ProveedorService.prototype, "crearProveedor", fallo as any);
  t.mock.method(ProveedorService.prototype, "listarProveedores", fallo as any);
  t.mock.method(ProveedorService.prototype, "buscarPorId", fallo as any);
  t.mock.method(ProveedorService.prototype, "buscarParcial", fallo as any);
  t.mock.method(ProveedorService.prototype, "actualizarProveedor", fallo as any);
  t.mock.method(ProveedorService.prototype, "desactivarProveedor", fallo as any);
  t.mock.method(ProveedorService.prototype, "eliminarProveedor", fallo as any);
  const controller = new ProveedorController();
  const req = { body: {}, query: {}, params: { id: "x" } } as any;

  for (const [metodo, status] of [
    ["crearProveedor", 400],
    ["listarProveedores", 404],
    ["buscarPorId", 404],
    ["buscarParcial", 404],
    ["actualizarProveedor", 400],
    ["desactivarProveedor", 400],
    ["eliminarProveedor", 400],
  ] as const) {
    const { response, estado } = crearRespuesta();
    await (controller[metodo] as any)(req, response);
    assert.equal(estado.status, status);
    assert.equal(estado.body.message, "fallo controlado");
  }

});
