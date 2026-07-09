import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../../../generated/prisma/client";
import { PublicCotizacionService } from "./public-cotizacion.service";
import { ProductoService } from "./producto.service";
import { EmailService } from "./email.service";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";

const cliente = {
  idCliente: 10,
  nombre: "Ana Cliente",
  documento: null,
  correo: "ana@pixel.test",
  telefono: "3001234567",
  direccion: null,
  estado: true,
};

const calculo = {
  items: [
    {
      idProducto: 1,
      producto: {
        idProducto: 1,
        nombre: "Camiseta",
        descripcion: null,
        categoriaProducto: { idCategoriaProducto: 1, nombre: "General" },
      },
      cantidad: 12,
      precioBase: 28000,
      descuentoPorcentaje: 7.14,
      descuentoAplicado: 1999,
      precioUnitario: 26001,
      subtotal: 312012,
      observaciones: "Talla M",
      snapshot: {
        idProducto: 1,
        descripcion: "Camiseta",
        cantidad: 12,
        precioBase: new Prisma.Decimal(28000),
        descuentoPorcentaje: new Prisma.Decimal(7.14),
        precioUnitario: new Prisma.Decimal(26001),
        subtotal: new Prisma.Decimal(312012),
        observaciones: "Talla M",
      },
    },
  ],
  subtotal: 312012,
  total: 312012,
};

const tecnica = {
  idTecnica: 5,
  nombre: "DTF",
  descripcion: "Estampacion DTF",
  estado: true,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
};

test("PublicCotizacionService lista solo tecnicas activas para landing", async (t) => {
  const listarMock = t.mock.method(
    TecnicaRepository.prototype,
    "listarTecnicasActivas",
    async () => [tecnica],
  );

  const tecnicas = await new PublicCotizacionService().listarTecnicas();

  assert.deepEqual(tecnicas, [tecnica]);
  assert.equal(listarMock.mock.calls.length, 1);
});

test("PublicCotizacionService no requiere login y crea cotizacion pendiente con Cliente externo", async (t) => {
  const staffAnterior = process.env.STAFF_EMAIL;
  process.env.STAFF_EMAIL = "staff@pixel.test";

  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => null,
  );
  const crearClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "crearCliente",
    async () => cliente,
  );
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculo);
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  const crearCotizacionMock = t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async (data: any) => ({ idCotizacion: 99, ...data }),
  );
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const service = new PublicCotizacionService();
  const respuesta = await service.crearCotizacion({
    cliente: {
      nombre: "Ana Cliente",
      correo: "ana@pixel.test",
      telefono: "3001234567",
    },
    items: [{ idProducto: 1, idTecnica: 5, cantidad: 12, observaciones: "Talla M", total: 1 }],
    total: 1,
    observaciones: "Publica",
  });

  const cotizacionData = crearCotizacionMock.mock.calls[0]?.arguments[0];
  assert.equal(crearClienteMock.mock.calls.length, 1);
  assert.equal(cotizacionData.idCliente, 10);
  assert.equal(cotizacionData.creadoPorId, null);
  assert.equal(cotizacionData.estado, "PENDIENTE");
  assert.equal(cotizacionData.tipoCotizacion, "PUBLICA");
  assert.equal(cotizacionData.total, 312012);
  assert.equal(cotizacionData.detalles[0].idTecnica, 5);
  assert.equal(cotizacionData.detalles[0].precioUnitario.toNumber(), 26001);
  assert.equal(respuesta.calculo.items[0]?.snapshot, undefined);
  assert.equal(sendMailMock.mock.calls.length, 2);
  const correoCliente = sendMailMock.mock.calls[0]?.arguments[0];
  const correoStaff = sendMailMock.mock.calls[1]?.arguments[0];
  assert.ok(correoCliente);
  assert.ok(correoStaff);
  assert.match(correoCliente.subject, /Cotizacion PIXEL #99/);
  assert.match(correoStaff.subject, /Nueva cotizacion publica #99/);
  assert.deepEqual(respuesta.email, {
    event: "COTIZACION_CREADA",
    cliente: "enviado",
    staff: "enviado",
  });

  if (staffAnterior === undefined) {
    delete process.env.STAFF_EMAIL;
  } else {
    process.env.STAFF_EMAIL = staffAnterior;
  }
});

test("PublicCotizacionService reutiliza Cliente y no rompe si falla email", async (t) => {
  const staffAnterior = process.env.STAFF_EMAIL;
  delete process.env.STAFF_EMAIL;
  t.mock.method(console, "error", () => undefined);

  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => cliente,
  );
  const actualizarClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "actualizarCliente",
    async (_id: number, data: any) => ({ ...cliente, ...data }),
  );
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculo);
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async (data: any) => ({ idCotizacion: 100, ...data }),
  );
  t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => {
      throw new Error("SMTP down");
    },
  );

  const service = new PublicCotizacionService();
  const respuesta = await service.crearCotizacion({
    cliente: {
      nombre: "Ana Actualizada",
      correo: "ana@pixel.test",
    },
    items: [{ idProducto: 1, idTecnica: 5, cantidad: 12 }],
  });

  assert.equal(actualizarClienteMock.mock.calls[0]?.arguments[0], 10);
  assert.equal(respuesta.cotizacion.idCotizacion, 100);
  assert.deepEqual(respuesta.email, {
    event: "COTIZACION_CREADA",
    cliente: "error",
    staff: "omitido",
  });

  if (staffAnterior !== undefined) {
    process.env.STAFF_EMAIL = staffAnterior;
  }
});

test("PublicCotizacionService falla con producto o cantidad invalida", async () => {
  const service = new PublicCotizacionService();

  await assert.rejects(
    () =>
      service.crearCotizacion({
        cliente: { nombre: "Ana", correo: "ana@pixel.test" },
        items: [{ idProducto: 1, cantidad: 0 }],
      }),
    /cantidad debe ser mayor a 0/,
  );
});

test("PublicCotizacionService falla con tecnica inexistente o inactiva", async (t) => {
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => cliente,
  );
  t.mock.method(
    ClienteRepository.prototype,
    "actualizarCliente",
    async () => cliente,
  );
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => ({
    ...tecnica,
    estado: false,
  }));

  await assert.rejects(
    () =>
      new PublicCotizacionService().crearCotizacion({
        cliente: { nombre: "Ana", correo: "ana@pixel.test" },
        items: [{ idProducto: 1, idTecnica: 5, cantidad: 1 }],
      }),
    /no existe o esta inactiva/,
  );
});
