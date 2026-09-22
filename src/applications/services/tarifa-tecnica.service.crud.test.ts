import assert from "node:assert/strict";
import test from "node:test";
import { TarifaTecnicaRepository } from "../../infrastructure/repositories/tarifa-tecnica.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { TarifaTecnicaService } from "./tarifa-tecnica.service";

const tarifa = {
  idTarifa: 5,
  idTecnica: 2,
  nombre: "General",
  esGeneral: true,
  anchoHastaCm: null,
  altoHastaCm: null,
  precioUnitario: 1000,
  estado: true,
};

test("TarifaTecnicaService lista, elimina y consulta descuentos", async (t) => {
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "listar",
    async () => ({ data: [tarifa], total: 1 }) as any,
  );
  t.mock.method(TarifaTecnicaRepository.prototype, "buscarPorId", async () => tarifa as any);
  const eliminar = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "eliminar",
    async () => tarifa as any,
  );
  const descuentos = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "listarDescuentos",
    async () => [{ cantidadMinima: 10, porcentaje: 5 }] as any,
  );
  const service = new TarifaTecnicaService();

  assert.equal((await service.listar({ page: "1", idTecnica: "2" } as any)).meta.total, 1);
  await service.eliminar(5);
  assert.equal(eliminar.mock.callCount(), 1);
  assert.equal((await service.listarDescuentos(2)).length, 1);
  assert.equal(descuentos.mock.callCount(), 1);
  await assert.rejects(() => service.eliminar(0), /tarifa debe ser valido/i);
});

test("TarifaTecnicaService actualiza dimensiones, precio y estado", async (t) => {
  let actual: any = {
    ...tarifa,
    nombre: "Mediana",
    esGeneral: false,
    anchoHastaCm: "20",
    altoHastaCm: "30",
  };
  let duplicada: any = null;
  t.mock.method(TarifaTecnicaRepository.prototype, "buscarPorId", async () => actual);
  t.mock.method(TarifaTecnicaRepository.prototype, "buscarDuplicada", async () => duplicada);
  const actualizar = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "actualizar",
    async (_id: number, data: any) => ({ ...actual, ...data }) as any,
  );
  const service = new TarifaTecnicaService();

  await service.actualizar(5, {
    nombre: " Grande ",
    anchoHastaCm: 40,
    altoHastaCm: 50,
    precioUnitario: 2000,
    estado: false,
  });
  const data = actualizar.mock.calls[0]?.arguments[1] as any;
  assert.equal(data.nombre, "Grande");
  assert.equal(data.anchoHastaCm.toString(), "40");
  assert.equal(data.altoHastaCm.toString(), "50");
  assert.equal(data.precioUnitario.toString(), "2000");
  assert.equal(data.estado, false);

  duplicada = { idTarifa: 8 };
  await assert.rejects(() => service.actualizar(5, { esGeneral: true }), /tarifa general/i);
  actual = null;
  await assert.rejects(() => service.actualizar(5, { estado: false }), /Tarifa no encontrada/i);
});

test("TarifaTecnicaService reemplaza descuentos normalizados", async (t) => {
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => ({ idTecnica: 2 }) as any);
  const reemplazar = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "reemplazarDescuentos",
    async (_id: number, descuentos: any[]) => descuentos as any,
  );
  const service = new TarifaTecnicaService();

  await service.reemplazarDescuentos(2, {
    descuentos: [
      { cantidadMinima: "10", porcentaje: "5.5" },
      { cantidadMinima: 20, porcentaje: 10, estado: false },
    ],
  });
  const data = reemplazar.mock.calls[0]?.arguments[1] as any[];
  assert.equal(data[0].cantidadMinima, 10);
  assert.equal(data[0].porcentaje.toString(), "5.5");
  assert.equal(data[0].estado, true);
  assert.equal(data[1].estado, false);

  await assert.rejects(
    () => service.reemplazarDescuentos(2, { descuentos: [{ cantidadMinima: 0, porcentaje: 5 }] }),
    /cantidad minima/i,
  );
});
