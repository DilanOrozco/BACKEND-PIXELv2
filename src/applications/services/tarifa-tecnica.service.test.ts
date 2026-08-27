import test from "node:test";
import assert from "node:assert/strict";
import { TarifaTecnicaService } from "./tarifa-tecnica.service";
import { TarifaTecnicaRepository } from "../../infrastructure/repositories/tarifa-tecnica.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";

const tecnica = {
  idTecnica: 3,
  nombre: "Servicio fijo",
  requiereMedidas: false,
  estado: true,
};

test("TarifaTecnicaService crea tarifa general sin dimensiones artificiales", async (t) => {
  t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorId",
    async () => tecnica as any,
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "buscarDuplicada",
    async () => null,
  );
  const crear = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "crear",
    async (data: any) => ({ idTarifa: 7, ...data }),
  );

  const resultado = await new TarifaTecnicaService().crear({
    idTecnica: 3,
    nombre: "Servicio fijo",
    esGeneral: true,
    precioUnitario: 7000,
  });
  const data = crear.mock.calls[0]!.arguments[0] as any;

  assert.equal(data.esGeneral, true);
  assert.equal(data.nombre, "Servicio fijo");
  assert.equal(data.anchoHastaCm, null);
  assert.equal(data.altoHastaCm, null);
  assert.equal(Number(data.precioUnitario), 7000);
  assert.equal(resultado.esGeneral, true);
});

test("TarifaTecnicaService mantiene tarifas dimensionales y evita generales duplicadas", async (t) => {
  t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorId",
    async () => ({ ...tecnica, requiereMedidas: true }) as any,
  );
  const duplicada = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "buscarDuplicada",
    async (
      _idTecnica: number,
      _ancho: any,
      _alto: any,
      esGeneral: boolean,
    ) => (esGeneral ? { idTarifa: 9 } : null),
  );
  const crear = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "crear",
    async (data: any) => ({ idTarifa: 8, ...data }),
  );
  const service = new TarifaTecnicaService();

  const dimensional = await service.crear({
    idTecnica: 3,
    nombre: "Manga",
    anchoHastaCm: 20,
    altoHastaCm: 30,
    precioUnitario: 12000,
  });

  assert.equal(dimensional.esGeneral, false);
  assert.equal(Number(dimensional.anchoHastaCm), 20);
  assert.equal(crear.mock.calls.length, 1);

  await assert.rejects(
    () =>
      service.crear({
        idTecnica: 3,
        nombre: "General",
        esGeneral: true,
        precioUnitario: 7000,
      }),
    /tarifa general/i,
  );
  assert.equal(duplicada.mock.calls.length, 2);
});

test("TarifaTecnicaService rechaza dimensiones parciales y tarifa general con medidas", async () => {
  const service = new TarifaTecnicaService();

  await assert.rejects(
    () =>
      service.crear({
        idTecnica: 3,
        nombre: "Incompleta",
        anchoHastaCm: 20,
        precioUnitario: 12000,
      }),
    /alto de la tarifa/i,
  );
  await assert.rejects(
    () =>
      service.crear({
        idTecnica: 3,
        nombre: "General",
        esGeneral: true,
        anchoHastaCm: 1,
        altoHastaCm: 1,
        precioUnitario: 7000,
      }),
    /tarifa general no debe incluir ancho ni alto/i,
  );
});

test("TarifaTecnicaService exige y normaliza el nombre descriptivo", async (t) => {
  const service = new TarifaTecnicaService();

  await assert.rejects(
    () =>
      service.crear({
        idTecnica: 3,
        anchoHastaCm: 10,
        altoHastaCm: 10,
        precioUnitario: 10000,
      }),
    /nombre es obligatorio/i,
  );

  t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorId",
    async () => ({ ...tecnica, requiereMedidas: true }) as any,
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "buscarDuplicada",
    async () => null,
  );
  const crear = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "crear",
    async (data: any) => ({ idTarifa: 10, ...data }),
  );

  await service.crear({
    idTecnica: 3,
    nombre: "  Punto corazon  ",
    anchoHastaCm: 10,
    altoHastaCm: 10,
    precioUnitario: 10000,
  });

  assert.equal(crear.mock.calls[0]!.arguments[0].nombre, "Punto corazon");
});
