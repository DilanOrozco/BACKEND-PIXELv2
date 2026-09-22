import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../config/prisma";
import {
  DeletionImpactRepository,
  type DeletionImpactResource,
} from "./deletion-impact.repository";

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

const delegates = [
  "passwordResetToken",
  "usuario",
  "cliente",
  "cotizacion",
  "abonos",
  "diseno",
  "compra",
  "cotizacionRespuesta",
  "detalleCotizacion",
  "cotizacionVersion",
  "pedido",
  "detallePedido",
  "detalleEstampadoPedido",
  "detalleCompra",
  "venta",
  "detalleEstampadoCotizacion",
  "tecnica",
  "tarifaTecnica",
  "descuentoTecnica",
  "productoCotizable",
  "precioProductoRango",
  "categoriaProducto",
  "proveedor",
] as const;

const record = {
  idPasswordResetToken: 1,
  idCliente: 2,
  idCotizacion: 3,
  idAbono: 4,
  idDiseno: 5,
  idCompra: 6,
  idRespuesta: 7,
  idDetalleCotizacion: 8,
  idVersion: 9,
  numeroVersion: 2,
  idPedido: 10,
  idDetallePedido: 11,
  idDetalleEstampadoPedido: 12,
  idDetalleCompra: 13,
  idVenta: 14,
  idDetalleEstampadoCotizacion: 15,
  idTarifa: 16,
  idDescuento: 17,
  idProducto: 18,
  idRango: 19,
  idCategoriaProducto: 20,
  idProveedor: 21,
  nombre: "Registro relacionado",
  descripcion: "Descripcion relacionada",
  ubicacion: "Frente",
  descripcionInsumo: "Insumo relacionado",
  cantidadMinima: 10,
  cantidadMin: 20,
  estado: "PENDIENTE",
};

const replaceMethod = (
  t: test.TestContext,
  delegate: Record<string, (...args: unknown[]) => unknown>,
  method: string,
  implementation: (...args: unknown[]) => unknown,
) => {
  const original = delegate[method]!;
  delegate[method] = implementation;
  t.after(() => {
    delegate[method] = original;
  });
};

const mockPrisma = (
  t: test.TestContext,
  options: { existe: boolean; cantidad: number },
) => {
  const client = prisma as unknown as Record<
    string,
    Record<string, (...args: unknown[]) => unknown>
  >;

  for (const delegateName of delegates) {
    const delegate = client[delegateName]!;

    if (typeof delegate.count === "function") {
      replaceMethod(t, delegate, "count", async () => options.cantidad);
    }
    if (typeof delegate.findMany === "function") {
      replaceMethod(t, delegate, "findMany", async () =>
        options.cantidad > 0 ? [record] : [],
      );
    }
    if (typeof delegate.findUnique === "function") {
      replaceMethod(t, delegate, "findUnique", async () =>
        options.existe ? record : null,
      );
    }
  }
};

test("DeletionImpactRepository describe dependencias reales de todos los recursos", async (t) => {
  mockPrisma(t, { existe: true, cantidad: 1 });
  const repository = new DeletionImpactRepository();
  const resultados = new Map<DeletionImpactResource, Awaited<ReturnType<typeof repository.obtener>>>();

  for (const resource of resources) {
    resultados.set(resource, await repository.obtener(resource, 7));
  }

  for (const resource of resources) {
    const resultado = resultados.get(resource);
    assert.equal(resultado?.existe, true, resource);
  }

  assert.equal(resultados.get("usuario")?.groups.length, 7);
  assert.equal(resultados.get("cliente")?.groups.length, 12);
  assert.equal(resultados.get("cotizacion")?.groups.length, 12);
  assert.equal(resultados.get("tecnica")?.groups.length, 6);
  assert.equal(resultados.get("producto")?.groups.length, 3);
  assert.equal(resultados.get("categoriaProducto")?.groups.length, 1);
  assert.equal(resultados.get("compra")?.groups.length, 1);
  assert.equal(resultados.get("tarifaTecnica")?.groups.length, 1);

  assert.equal(resultados.get("cliente")?.options?.puedeEliminar, false);
  assert.equal(resultados.get("cotizacion")?.options?.puedeEliminar, false);
  assert.equal(resultados.get("categoriaProducto")?.options?.puedeEliminar, false);
  assert.equal(resultados.get("proveedor")?.options?.puedeEliminar, false);
  assert.equal(resultados.get("compra")?.options, undefined);
  assert.equal(resultados.get("abono")?.options, undefined);
  assert.equal(resultados.get("diseno")?.options, undefined);

  const usuario = resultados.get("usuario");
  assert.equal(usuario?.groups[0]?.registros[0]?.nombre, "Token #1");
  assert.equal(
    usuario?.groups.find((group) => group.tipo === "Disenos gestionados")
      ?.registros[0]?.nombre,
    "Descripcion relacionada",
  );
});

test("DeletionImpactRepository distingue recursos inexistentes sin consultar dependencias", async (t) => {
  mockPrisma(t, { existe: false, cantidad: 0 });
  const repository = new DeletionImpactRepository();

  for (const resource of resources) {
    assert.deepEqual(await repository.obtener(resource, 999), {
      existe: false,
      groups: [],
    });
  }
});

test("DeletionImpactRepository conserva bloqueos según estado e historial", async (t) => {
  mockPrisma(t, { existe: true, cantidad: 0 });
  const client = prisma as unknown as Record<
    string,
    Record<string, (...args: unknown[]) => unknown>
  >;

  client.compra!.findUnique = async () => ({
    ...record,
    estado: "CONFIRMADA",
  });
  client.abonos!.findUnique = async () => ({
    ...record,
    estado: "CONFIRMADO",
  });
  client.diseno!.findUnique = async () => ({
    ...record,
    estado: "APROBADO",
  });

  const repository = new DeletionImpactRepository();

  assert.equal((await repository.obtener("compra", 1)).options?.puedeEliminar, false);
  assert.equal((await repository.obtener("abono", 1)).options?.puedeEliminar, false);
  assert.equal((await repository.obtener("diseno", 1)).options?.puedeEliminar, false);
  assert.equal((await repository.obtener("cliente", 1)).options, undefined);
  assert.equal((await repository.obtener("cotizacion", 1)).options, undefined);
  assert.equal((await repository.obtener("categoriaProducto", 1)).options, undefined);
  assert.equal((await repository.obtener("proveedor", 1)).options, undefined);
});
