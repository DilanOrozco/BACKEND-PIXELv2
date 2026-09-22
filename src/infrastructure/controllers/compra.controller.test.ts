import assert from "node:assert/strict";
import test from "node:test";
import { CompraService } from "../../applications/services/compra.service";
import { CompraController } from "./compra.controller";

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

test("CompraController conserva contratos HTTP exitosos", async (t) => {
  const compra = { idCompra: 7 } as any;
  const resumen = { totalCompras: 1000 } as any;
  t.mock.method(CompraService.prototype, "crearCompra", async () => compra);
  t.mock.method(CompraService.prototype, "listarCompras", async () => [compra] as any);
  t.mock.method(CompraService.prototype, "listarPorPedido", async () => [compra] as any);
  t.mock.method(CompraService.prototype, "buscarPorId", async () => compra);
  t.mock.method(CompraService.prototype, "actualizarCompra", async () => compra);
  t.mock.method(CompraService.prototype, "confirmarCompra", async () => compra);
  t.mock.method(CompraService.prototype, "anularCompra", async () => compra);
  t.mock.method(CompraService.prototype, "eliminarCompra", async () => compra);
  t.mock.method(CompraService.prototype, "obtenerResumen", async () => resumen);
  const controller = new CompraController();
  const req = {
    body: { observaciones: "ok" },
    query: { estado: "PENDIENTE" },
    params: { id: "7", idPedido: "9" },
    user: { idUsuario: 1, rol: "Admin" },
  } as any;

  for (const [metodo, status, mensaje] of [
    ["crearCompra", 201, "Compra creada correctamente."],
    ["listarCompras", 200, undefined],
    ["listarPorPedido", 200, undefined],
    ["buscarPorId", 200, undefined],
    ["actualizarCompra", 200, "Compra actualizada correctamente."],
    ["confirmarCompra", 200, "Compra confirmada correctamente."],
    ["anularCompra", 200, "Compra anulada correctamente."],
    ["eliminarCompra", 200, "Compra eliminada correctamente."],
    ["obtenerResumen", 200, undefined],
  ] as const) {
    const { response, estado } = crearRespuesta();
    await (controller[metodo] as any)(req, response);
    assert.equal(estado.status, status);
    if (mensaje) assert.equal(estado.body.message, mensaje);
    assert.ok(estado.body.data);
  }
});

test("CompraController traduce errores del servicio a códigos existentes", async (t) => {
  const fallo = async () => {
    throw new Error("fallo controlado");
  };
  t.mock.method(CompraService.prototype, "crearCompra", fallo as any);
  t.mock.method(CompraService.prototype, "listarCompras", fallo as any);
  t.mock.method(CompraService.prototype, "listarPorPedido", fallo as any);
  t.mock.method(CompraService.prototype, "buscarPorId", fallo as any);
  t.mock.method(CompraService.prototype, "actualizarCompra", fallo as any);
  t.mock.method(CompraService.prototype, "confirmarCompra", fallo as any);
  t.mock.method(CompraService.prototype, "anularCompra", fallo as any);
  t.mock.method(CompraService.prototype, "eliminarCompra", fallo as any);
  t.mock.method(CompraService.prototype, "obtenerResumen", fallo as any);
  const controller = new CompraController();
  const req = { body: {}, query: {}, params: { id: "x", idPedido: "x" } } as any;

  for (const [metodo, status] of [
    ["crearCompra", 400],
    ["listarCompras", 404],
    ["listarPorPedido", 404],
    ["buscarPorId", 404],
    ["actualizarCompra", 400],
    ["confirmarCompra", 400],
    ["anularCompra", 400],
    ["eliminarCompra", 400],
    ["obtenerResumen", 400],
  ] as const) {
    const { response, estado } = crearRespuesta();
    await (controller[metodo] as any)(req, response);
    assert.equal(estado.status, status);
    assert.equal(estado.body.message, "fallo controlado");
  }
});
