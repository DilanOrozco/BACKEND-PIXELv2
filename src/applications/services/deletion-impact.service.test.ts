import test from "node:test";
import assert from "node:assert/strict";
import { DeletionImpactService } from "./deletion-impact.service";
import {
  DeletionImpactRepository,
  type DeletionImpactResource,
} from "../../infrastructure/repositories/deletion-impact.repository";

const resources: DeletionImpactResource[] = [
  "usuario",
  "cliente",
  "cotizacion",
  "tecnica",
  "producto",
  "categoriaProducto",
  "compra",
  "tarifaTecnica",
  "abono",
  "diseno",
  "proveedor",
];

for (const resource of resources) {
  test(`impacto de ${resource} usa solo la consulta de lectura`, async (t) => {
    const obtenerMock = t.mock.method(
      DeletionImpactRepository.prototype,
      "obtener",
      async (recurso: DeletionImpactResource, id: number) => ({
        existe: true,
        groups: [
          {
            tipo: "Registros relacionados",
            accion: recurso === "tecnica" ? "DESVINCULAR" as const : "ELIMINAR" as const,
            cantidad: 1,
            registros: [{ id, nombre: `Registro #${id}` }],
          },
        ],
      }),
    );

    const resultado = await new DeletionImpactService().obtener(resource, 7);

    assert.equal(obtenerMock.mock.callCount(), 1);
    assert.deepEqual(obtenerMock.mock.calls[0]?.arguments, [resource, 7]);
    assert.equal(resultado.totalAfectados, 1);
    assert.equal(resultado.requiereConfirmacionReforzada, true);
    assert.equal(resultado.afectados[0]?.registros[0]?.nombre, "Registro #7");
  });
}

test("impacto conserva el total completo y limita la muestra a diez registros", async (t) => {
  t.mock.method(
    DeletionImpactRepository.prototype,
    "obtener",
    async () => ({
      existe: true,
      groups: [
        {
          tipo: "Detalles",
          accion: "ELIMINAR" as const,
          cantidad: 14,
          registros: Array.from({ length: 10 }, (_, index) => ({
            id: index + 1,
            nombre: `Detalle #${index + 1}`,
          })),
        },
      ],
    }),
  );

  const resultado = await new DeletionImpactService().obtener("compra", 1);

  assert.equal(resultado.limiteRegistrosPorTipo, 10);
  assert.equal(resultado.totalAfectados, 14);
  assert.equal(resultado.afectados[0]?.registros.length, 10);
  assert.equal(resultado.afectados[0]?.registrosOmitidos, 4);
});

test("impacto bloqueado explica la razon sin ocultar dependencias reales", async (t) => {
  t.mock.method(
    DeletionImpactRepository.prototype,
    "obtener",
    async () => ({
      existe: true,
      groups: [
        {
          tipo: "Pedidos",
          accion: "ELIMINAR" as const,
          cantidad: 2,
          registros: [
            { id: 10, nombre: "Pedido #10" },
            { id: 11, nombre: "Pedido #11" },
          ],
        },
      ],
      options: {
        puedeEliminar: false,
        motivoBloqueo: "Debe conservarse como historial.",
      },
    }),
  );

  const resultado = await new DeletionImpactService().obtener("cliente", 3);

  assert.equal(resultado.puedeEliminar, false);
  assert.equal(resultado.motivoBloqueo, "Debe conservarse como historial.");
  assert.equal(resultado.totalAfectados, 2);
});

test("impacto admite las tres acciones estandarizadas", async (t) => {
  t.mock.method(
    DeletionImpactRepository.prototype,
    "obtener",
    async () => ({
      existe: true,
      groups: [
        { tipo: "A", accion: "ELIMINAR" as const, cantidad: 1, registros: [] },
        { tipo: "B", accion: "DESVINCULAR" as const, cantidad: 1, registros: [] },
        { tipo: "C", accion: "ACTUALIZAR" as const, cantidad: 1, registros: [] },
      ],
    }),
  );

  const resultado = await new DeletionImpactService().obtener("usuario", 1);

  assert.deepEqual(
    resultado.afectados.map((grupo) => grupo.accion),
    ["ELIMINAR", "DESVINCULAR", "ACTUALIZAR"],
  );
});

test("impacto responde error humano para un recurso inexistente", async (t) => {
  t.mock.method(
    DeletionImpactRepository.prototype,
    "obtener",
    async () => ({ existe: false, groups: [] }),
  );

  await assert.rejects(
    () => new DeletionImpactService().obtener("producto", 999),
    /No se encontro el producto/,
  );
});

test("impacto rechaza identificadores invalidos antes de consultar Prisma", async (t) => {
  const obtenerMock = t.mock.method(
    DeletionImpactRepository.prototype,
    "obtener",
    async () => ({ existe: true, groups: [] }),
  );

  await assert.rejects(
    () => new DeletionImpactService().obtener("tecnica", 0),
    /ID indicado no es valido/,
  );
  assert.equal(obtenerMock.mock.callCount(), 0);
});
