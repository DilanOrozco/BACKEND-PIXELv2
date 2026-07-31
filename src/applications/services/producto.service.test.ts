import test from "node:test";
import assert from "node:assert/strict";
import { ProductoService } from "./producto.service";
import { ProductoRepository } from "../../infrastructure/repositories/producto.repository";
import { CategoriaProductoRepository } from "../../infrastructure/repositories/categoria-producto.repository";
import { productoPublicSelect } from "../../utils/selects/producto.select";

const categoria = {
  idCategoriaProducto: 1,
  nombre: "General",
  descripcion: null,
  estado: true,
};

const rangos = [
  { idRango: 1, idProducto: 1, cantidadMin: 1, descuentoPorcentaje: 0, estado: true },
  { idRango: 2, idProducto: 1, cantidadMin: 12, descuentoPorcentaje: 7.14, estado: true },
  { idRango: 3, idProducto: 1, cantidadMin: 24, descuentoPorcentaje: 17.86, estado: true },
  { idRango: 4, idProducto: 1, cantidadMin: 50, descuentoPorcentaje: 21.43, estado: true },
  { idRango: 5, idProducto: 1, cantidadMin: 100, descuentoPorcentaje: 28.57, estado: true },
];

const producto = {
  idProducto: 1,
  idCategoriaProducto: 1,
  nombre: "Camiseta",
  descripcion: null,
  precioBase: 28000,
  estado: true,
  categoriaProducto: categoria,
  rangos,
};

test("select publico de producto expone catalogo sin precios internos", () => {
  assert.equal(productoPublicSelect.idProducto, true);
  assert.equal(productoPublicSelect.descripcion, true);
  assert.equal(productoPublicSelect.requiereDiseno, true);
  assert.equal(productoPublicSelect.estado, true);
  assert.equal("precioBase" in productoPublicSelect, false);
  assert.equal("rangos" in productoPublicSelect, false);
});

test("ProductoService crea producto con categoria y falla sin categoria", async (t) => {
  t.mock.method(ProductoRepository.prototype, "buscarPorNombreExacto", async () => null);
  t.mock.method(
    CategoriaProductoRepository.prototype,
    "buscarActivaPorId",
    async () => categoria,
  );
  const crearMock = t.mock.method(
    ProductoRepository.prototype,
    "crearProducto",
    async (data: any) => ({ ...producto, ...data }),
  );

  const service = new ProductoService();
  const creado = await service.crearProducto({
    nombre: "Camiseta",
    precioBase: 28000,
    idCategoriaProducto: 1,
  });

  assert.equal(creado.idCategoriaProducto, 1);
  assert.equal(crearMock.mock.calls[0]?.arguments[0].idCategoriaProducto, 1);
  await assert.rejects(
    () => service.crearProducto({ nombre: "Camiseta", precioBase: 28000 }),
    /categoria del producto es obligatoria/,
  );
});

test("ProductoService lista con categoria, filtro, paginacion, search y sort", async (t) => {
  const listarMock = t.mock.method(
    ProductoRepository.prototype,
    "listarProductosPaginado",
    async () => ({ data: [producto], total: 1 }),
  );

  const service = new ProductoService();
  const respuesta = await service.listarProductos({
    page: "1",
    limit: "99",
    search: "cam",
    sortBy: "nombre",
    order: "asc",
    idCategoriaProducto: "1",
  });

  const [pagination, filtros] = listarMock.mock.calls[0]?.arguments ?? [];
  assert.ok(pagination);
  assert.equal(pagination.limit, 10);
  assert.equal(pagination.search, "cam");
  assert.deepEqual(filtros, { idCategoriaProducto: 1 });
  assert.equal(respuesta.data[0]?.categoriaProducto?.nombre, "General");
  assert.equal(respuesta.data[0]?.rangosDescuento[1].cantidadMinima, 12);
  assert.equal(respuesta.data[0]?.rangosDescuento[1].porcentaje, 7.14);
});

test("ProductoService edita categoria valida y desactiva producto", async (t) => {
  t.mock.method(ProductoRepository.prototype, "buscarPorId", async () => producto);
  t.mock.method(ProductoRepository.prototype, "buscarPorNombreExacto", async () => null);
  t.mock.method(
    CategoriaProductoRepository.prototype,
    "buscarActivaPorId",
    async () => categoria,
  );
  const actualizarMock = t.mock.method(
    ProductoRepository.prototype,
    "actualizarProducto",
    async (_id: number, data: any) => ({ ...producto, ...data }),
  );
  const desactivarMock = t.mock.method(
    ProductoRepository.prototype,
    "desactivarProducto",
    async () => ({ ...producto, estado: false }),
  );

  const service = new ProductoService();
  const editado = await service.actualizarProducto(1, {
    precioBase: 30000,
    idCategoriaProducto: 1,
  });
  const desactivado = await service.desactivarProducto(1);

  assert.equal(editado.precioBase?.toNumber(), 30000);
  assert.equal(actualizarMock.mock.calls[0]?.arguments[1].idCategoriaProducto, 1);
  assert.equal(desactivado.estado, false);
  assert.equal(desactivarMock.mock.calls[0]?.arguments[0], 1);
});

test("ProductoService gestiona rangos con nombres nuevos y conserva aliases legacy", async (t) => {
  t.mock.method(ProductoRepository.prototype, "buscarPorId", async () => producto);
  t.mock.method(
    ProductoRepository.prototype,
    "listarRangos",
    async () => rangos as any,
  );
  const reemplazar = t.mock.method(
    ProductoRepository.prototype,
    "reemplazarRangos",
    async () => producto as any,
  );
  const service = new ProductoService();
  const listado = await service.listarRangos(1);
  const actualizado = await service.reemplazarRangos(1, {
    rangos: [
      { cantidadMinima: 1, porcentaje: 0 },
      { cantidadMinima: 10, porcentaje: 8 },
    ],
  });
  const payload = reemplazar.mock.calls[0]!.arguments[1] as any[];

  assert.equal(listado[1].cantidadMinima, 12);
  assert.equal(listado[1].cantidadMin, 12);
  assert.equal(listado[1].porcentaje, 7.14);
  assert.equal(payload[1].cantidadMin, 10);
  assert.equal(Number(payload[1].descuentoPorcentaje), 8);
  assert.equal(actualizado.rangosDescuento[1].cantidadMinima, 12);
});

test("ProductoService calcula rangos de descuento y snapshots sin confiar en frontend", async (t) => {
  t.mock.method(ProductoRepository.prototype, "buscarActivosPorIds", async () => [producto]);
  const service = new ProductoService();
  const casos = [
    { cantidad: 1, descuento: 0, precioUnitario: 28000, subtotal: 28000, descuentoTotal: 0, total: 28000 },
    { cantidad: 12, descuento: 7.14, precioUnitario: 26001, subtotal: 336000, descuentoTotal: 23990, total: 312010 },
    { cantidad: 24, descuento: 17.86, precioUnitario: 22999, subtotal: 672000, descuentoTotal: 120019, total: 551981 },
    { cantidad: 50, descuento: 21.43, precioUnitario: 22000, subtotal: 1400000, descuentoTotal: 300020, total: 1099980 },
    { cantidad: 100, descuento: 28.57, precioUnitario: 20000, subtotal: 2800000, descuentoTotal: 799960, total: 2000040 },
    { cantidad: 150, descuento: 28.57, precioUnitario: 20000, subtotal: 4200000, descuentoTotal: 1199940, total: 3000060 },
  ];

  for (const caso of casos) {
    const calculo = await service.calcularItems([
      { idProducto: 1, cantidad: caso.cantidad },
    ]);

    assert.equal(calculo.items[0]?.descuentoPorcentaje, caso.descuento);
    assert.equal(calculo.items[0]?.precioUnitario, caso.precioUnitario);
    assert.equal(calculo.items[0]?.subtotal, caso.subtotal);
    assert.equal(calculo.items[0]?.subtotalBruto, caso.subtotal);
    assert.equal(calculo.items[0]?.descuentoTotal, caso.descuentoTotal);
    assert.equal(calculo.items[0]?.descuentoAplicado, caso.descuentoTotal);
    assert.equal(calculo.items[0]?.subtotalConDescuento, caso.total);
    assert.equal(calculo.items[0]?.subtotalFinal, caso.total);
    assert.equal(calculo.items[0]?.snapshot.precioUnitario.toNumber(), caso.precioUnitario);
    assert.equal(calculo.items[0]?.snapshot.subtotal.toNumber(), caso.subtotal);
    assert.equal(calculo.items[0]?.snapshot.subtotalConDescuento.toNumber(), caso.total);
    assert.equal(calculo.subtotal, caso.subtotal);
    assert.equal(calculo.descuentoTotal, caso.descuentoTotal);
    assert.equal(calculo.total, caso.total);
  }
});

test("ProductoService calcula subtotal bruto descuento total y total final", async (t) => {
  t.mock.method(ProductoRepository.prototype, "buscarActivosPorIds", async () => [{
    ...producto,
    precioBase: 30000,
    rangos: [
      { idRango: 1, idProducto: 1, cantidadMin: 1, descuentoPorcentaje: 15, estado: true },
    ],
  }]);

  const calculo = await new ProductoService().calcularItems([
    { idProducto: 1, cantidad: 2000 },
  ]);

  assert.equal(calculo.items[0]?.precioBase, 30000);
  assert.equal(calculo.items[0]?.descuentoPorcentaje, 15);
  assert.equal(calculo.items[0]?.descuentoValorUnitario, 4500);
  assert.equal(calculo.items[0]?.precioUnitario, 25500);
  assert.equal(calculo.items[0]?.subtotal, 60000000);
  assert.equal(calculo.items[0]?.subtotalBruto, 60000000);
  assert.equal(calculo.items[0]?.descuentoTotal, 9000000);
  assert.equal(calculo.items[0]?.subtotalConDescuento, 51000000);
  assert.equal(calculo.items[0]?.subtotalFinal, 51000000);
  assert.equal(calculo.subtotal, 60000000);
  assert.equal(calculo.descuentoTotal, 9000000);
  assert.equal(calculo.total, 51000000);
});

test("ProductoService calcula y agrega varios productos en una cotizacion", async (t) => {
  const buscarProductosMock = t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async (idsProductos: number[]) =>
      idsProductos.map((idProducto) =>
        idProducto === 1
          ? producto
          : {
              ...producto,
              idProducto: 2,
              nombre: "Gorra",
              precioBase: 13000,
              rangos: [
                {
                  idRango: 10,
                  idProducto: 2,
                  cantidadMin: 1,
                  descuentoPorcentaje: 0,
                  estado: true,
                },
              ],
            },
      ),
  );

  const calculo = await new ProductoService().calcularItems([
    { idProducto: 1, cantidad: 12 },
    { idProducto: 2, cantidad: 2 },
  ]);

  assert.equal(calculo.items.length, 2);
  assert.equal(calculo.subtotalBruto, 362000);
  assert.equal(calculo.descuentoTotal, 23990);
  assert.equal(calculo.subtotalConDescuento, 338010);
  assert.equal(calculo.costoDiseno, 0);
  assert.equal(calculo.total, 338010);
  assert.equal(buscarProductosMock.mock.calls.length, 1);
  assert.deepEqual(buscarProductosMock.mock.calls[0]?.arguments[0], [1, 2]);
});

test("ProductoService falla con producto inactivo o cantidad invalida", async (t) => {
  t.mock.method(ProductoRepository.prototype, "buscarActivosPorIds", async () => []);
  const service = new ProductoService();

  await assert.rejects(
    () => service.calcularItems([{ idProducto: 1, cantidad: 0 }]),
    /cantidad debe ser mayor a 0/,
  );
  await assert.rejects(
    () => service.calcularItems([{ idProducto: 1, cantidad: 1 }]),
    /no existe o esta inactivo/,
  );
});
