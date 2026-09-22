import assert from "node:assert/strict";
import test from "node:test";
import {
  validarActualizarCompra,
  validarAnularCompra,
  validarCrearCompra,
  validarFiltrosCompra,
  validarFiltrosResumenCompra,
} from "./compra.validator";

const detalleValido = {
  descripcionInsumo: "Tela",
  cantidad: 2,
  costoUnitario: 15000,
};

test("validarCrearCompra acepta el contrato y rechaza cálculos o detalles manipulados", () => {
  assert.equal(
    validarCrearCompra({ idPedido: 1, idProveedor: 2, detalles: [detalleValido] }),
    null,
  );

  const casos: Array<[Record<string, unknown> | undefined, RegExp]> = [
    [{ total: 1 }, /total.*automaticamente/i],
    [{ subtotal: 1 }, /subtotal.*automaticamente/i],
    [{ idPedido: 0, idProveedor: 2, detalles: [detalleValido] }, /pedido.*valido/i],
    [{ idPedido: 1, idProveedor: "x", detalles: [detalleValido] }, /proveedor.*valido/i],
    [{ idPedido: 1, idProveedor: 2, confirmar: "true", detalles: [detalleValido] }, /confirmar.*booleano/i],
    [{ idPedido: 1, idProveedor: 2 }, /al menos un detalle/i],
    [{ idPedido: 1, idProveedor: 2, detalles: [] }, /al menos un detalle/i],
    [{ idPedido: 1, idProveedor: 2, detalles: [null] }, /objeto valido/i],
    [{ idPedido: 1, idProveedor: 2, detalles: [{ ...detalleValido, subtotal: 1 }] }, /subtotal.*automaticamente/i],
    [{ idPedido: 1, idProveedor: 2, detalles: [{ ...detalleValido, extra: true }] }, /campo extra/i],
    [{ idPedido: 1, idProveedor: 2, detalles: [{ ...detalleValido, descripcionInsumo: " " }] }, /descripcion.*obligatoria/i],
    [{ idPedido: 1, idProveedor: 2, detalles: [{ ...detalleValido, cantidad: 0 }] }, /cantidad.*mayor/i],
    [{ idPedido: 1, idProveedor: 2, detalles: [{ ...detalleValido, costoUnitario: null }] }, /costo unitario.*mayor/i],
  ];

  for (const [entrada, esperado] of casos) {
    assert.match(validarCrearCompra(entrada) ?? "", esperado);
  }
});

test("validadores de actualización y anulación limitan campos y tipos", () => {
  assert.equal(validarActualizarCompra({ observaciones: null }), null);
  assert.match(validarActualizarCompra({}) ?? "", /al menos un campo/i);
  assert.match(validarActualizarCompra({ idProveedor: 0 }) ?? "", /proveedor.*valido/i);
  assert.match(validarActualizarCompra({ observaciones: 5 }) ?? "", /observaciones.*texto/i);
  assert.match(validarActualizarCompra({ detalles: "no-array" }) ?? "", /al menos un detalle/i);
  assert.equal(validarAnularCompra({ observaciones: "Motivo" }), null);
  assert.match(validarAnularCompra({ estado: "ANULADA" }) ?? "", /campo estado/i);
  assert.match(validarAnularCompra({ observaciones: 5 }) ?? "", /observaciones.*texto/i);
});

test("validadores de filtros cubren IDs, estados y fechas", () => {
  assert.equal(
    validarFiltrosCompra({
      idPedido: "1",
      idProveedor: 2,
      compradoPorId: 3,
      estado: "COMPRADA",
      desde: "2026-09-01",
      hasta: "2026-09-30",
    }),
    null,
  );

  for (const [entrada, esperado] of [
    [{ desconocido: true }, /campo desconocido/i],
    [{ idPedido: 0 }, /pedido.*valido/i],
    [{ idProveedor: "x" }, /proveedor.*valido/i],
    [{ compradoPorId: -1 }, /usuario comprador.*valido/i],
    [{ estado: "OTRA" }, /estado.*valido/i],
    [{ desde: "no-fecha" }, /fecha desde.*valida/i],
    [{ hasta: 123 }, /fecha hasta.*valida/i],
  ] as Array<[Record<string, unknown>, RegExp]>) {
    assert.match(validarFiltrosCompra(entrada) ?? "", esperado);
  }

  assert.equal(validarFiltrosResumenCompra({ idPedido: 1, idProveedor: 2 }), null);
  assert.match(validarFiltrosResumenCompra({ idPedido: 0 }) ?? "", /pedido.*valido/i);
  assert.match(validarFiltrosResumenCompra({ idProveedor: 0 }) ?? "", /proveedor.*valido/i);
  assert.match(validarFiltrosResumenCompra({ desde: "x" }) ?? "", /fecha desde.*valida/i);
  assert.match(validarFiltrosResumenCompra({ hasta: "x" }) ?? "", /fecha hasta.*valida/i);
});
