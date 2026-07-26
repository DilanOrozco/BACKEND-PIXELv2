import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../../../generated/prisma/client";
import { PublicCotizacionService } from "./public-cotizacion.service";
import { ProductoService } from "./producto.service";
import { EmailService } from "./email.service";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { ClienteAccessService } from "./cliente-access.service";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";

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
      descuentoValorUnitario: 1999,
      descuentoAplicado: 23990,
      descuentoTotal: 23990,
      precioUnitario: 26001,
      subtotalBruto: 336000,
      subtotal: 336000,
      subtotalConDescuento: 312010,
      subtotalFinal: 312010,
      observaciones: "Talla M",
      snapshot: {
        idProducto: 1,
        descripcion: "Camiseta",
        cantidad: 12,
        precioBase: new Prisma.Decimal(28000),
        descuentoPorcentaje: new Prisma.Decimal(7.14),
        descuentoValorUnitario: new Prisma.Decimal(1999),
        precioUnitario: new Prisma.Decimal(26001),
        subtotal: new Prisma.Decimal(336000),
        subtotalBruto: new Prisma.Decimal(336000),
        descuentoTotal: new Prisma.Decimal(23990),
        subtotalConDescuento: new Prisma.Decimal(312010),
        observaciones: "Talla M",
      },
    },
  ],
  subtotal: 336000,
  subtotalBruto: 336000,
  descuentoTotal: 23990,
  costosAdicionales: 0,
  total: 312010,
};

const calculoMultiple = {
  ...calculo,
  items: [
    ...calculo.items,
    {
      idProducto: 2,
      producto: {
        idProducto: 2,
        nombre: "Gorra",
        descripcion: null,
        categoriaProducto: { idCategoriaProducto: 1, nombre: "General" },
      },
      cantidad: 24,
      precioBase: 13000,
      descuentoPorcentaje: 17.86,
      descuentoValorUnitario: 2322,
      descuentoAplicado: 55723,
      descuentoTotal: 55723,
      precioUnitario: 10678,
      subtotalBruto: 312000,
      subtotal: 312000,
      subtotalConDescuento: 256277,
      subtotalFinal: 256277,
      observaciones: null,
      snapshot: {
        idProducto: 2,
        descripcion: "Gorra",
        cantidad: 24,
        precioBase: new Prisma.Decimal(13000),
        descuentoPorcentaje: new Prisma.Decimal(17.86),
        descuentoValorUnitario: new Prisma.Decimal(2322),
        precioUnitario: new Prisma.Decimal(10678),
        subtotal: new Prisma.Decimal(312000),
        subtotalBruto: new Prisma.Decimal(312000),
        descuentoTotal: new Prisma.Decimal(55723),
        subtotalConDescuento: new Prisma.Decimal(256277),
        observaciones: null,
      },
    },
  ],
  subtotal: 648000,
  subtotalBruto: 648000,
  descuentoTotal: 79713,
  subtotalConDescuento: 568287,
  costoDiseno: 0,
  total: 568287,
};

const tecnica = {
  idTecnica: 5,
  nombre: "DTF",
  descripcion: "Estampacion DTF",
  estado: true,
  fechaCreacion: new Date("2026-01-01"),
  fechaActualizacion: new Date("2026-01-01"),
};
const tecnicaSublimacion = {
  ...tecnica,
  idTecnica: 6,
  nombre: "Sublimacion",
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
  t.mock.method(ClienteRepository.prototype, "buscarPorCorreo", async () => null);
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => null);
  const crearClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "crearCliente",
    async () => cliente,
  );
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculo);
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  t.mock.method(
    ClienteAccessService.prototype,
    "asegurarAccesoCliente",
    async () => ({
      usuarioCreado: true,
      usuarioExistente: false,
      linkCrearPassword: "https://pixel.test/crear-password-cliente/token",
      idUsuario: 77,
    }),
  );
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
  assert.equal(cotizacionData.subtotal, 336000);
  assert.equal(cotizacionData.descuentoTotal, 23990);
  assert.equal(cotizacionData.total, 312010);
  assert.equal(cotizacionData.detalles[0].idTecnica, 5);
  assert.equal(cotizacionData.detalles[0].precioUnitario.toNumber(), 26001);
  assert.equal(cotizacionData.detalles[0].subtotal.toNumber(), 336000);
  assert.equal(cotizacionData.detalles[0].descuentoTotal.toNumber(), 23990);
  assert.equal(cotizacionData.detalles[0].subtotalConDescuento.toNumber(), 312010);
  assert.equal(respuesta.calculo.items[0]?.snapshot, undefined);
  assert.equal(sendMailMock.mock.calls.length, 2);
  const correoCliente = sendMailMock.mock.calls[0]?.arguments[0];
  const correoStaff = sendMailMock.mock.calls[1]?.arguments[0];
  assert.ok(correoCliente);
  assert.ok(correoStaff);
  assert.match(correoCliente.subject, /Recibimos tu solicitud de cotizacion/);
  assert.doesNotMatch(correoCliente.subject, /#99/);
  assert.doesNotMatch(correoCliente.text, /cotizacion #99/i);
  assert.match(correoCliente.text, /Creamos un acceso/);
  assert.match(correoCliente.text, /crear-password-cliente\/token/);
  assert.match(correoCliente.text, /Tecnica: DTF/);
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

test("PublicCotizacionService permite cotizar al Cliente autenticado sin confiar en el payload", async (t) => {
  const staffAnterior = process.env.STAFF_EMAIL;
  delete process.env.STAFF_EMAIL;
  t.mock.method(console, "error", () => undefined);

  const crearClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "crearCliente",
    async () => {
      throw new Error("No debe crear otro Cliente.");
    },
  );
  const actualizarClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "actualizarCliente",
    async () => {
      throw new Error("No debe modificar el Cliente autenticado.");
    },
  );
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculo);
  t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorId",
    async (idTecnica: number) =>
      idTecnica === 6 ? tecnicaSublimacion : tecnica,
  );
  const asegurarAccesoMock = t.mock.method(
    ClienteAccessService.prototype,
    "asegurarAccesoCliente",
    async () => {
      throw new Error("No debe crear ni reutilizar otro Usuario.");
    },
  );
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente,
  );
  const crearCotizacionMock = t.mock.method(
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
      nombre: "Otro Cliente",
      correo: "otro@pixel.test",
      telefono: "3119999999",
    },
    items: [{ idProducto: 1, idTecnica: 5, cantidad: 12 }],
  }, {
    idUsuario: 77,
    rol: "Cliente",
  });

  const datosCotizacion = crearCotizacionMock.mock.calls[0]?.arguments[0];
  assert.equal(datosCotizacion.idCliente, cliente.idCliente);
  assert.equal(crearClienteMock.mock.calls.length, 0);
  assert.equal(actualizarClienteMock.mock.calls.length, 0);
  assert.equal(asegurarAccesoMock.mock.calls.length, 0);
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

test("PublicCotizacionService calcula y crea una cotizacion con varios productos", async (t) => {
  delete process.env.STAFF_EMAIL;
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente,
  );
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculoMultiple);
  t.mock.method(
    TecnicaRepository.prototype,
    "buscarPorId",
    async (idTecnica: number) =>
      idTecnica === 6 ? tecnicaSublimacion : tecnica,
  );
  const crearCotizacionMock = t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async (data: any) => ({ idCotizacion: 102, ...data }),
  );
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );
  const items = [
    {
      idProducto: 1,
      idTecnica: 5,
      cantidad: 12,
      requiereDiseno: false,
      origenDiseno: "PIXEL",
    },
    {
      idProducto: 2,
      idTecnica: 6,
      cantidad: 24,
      requiereDiseno: true,
      origenDiseno: "CLIENTE",
      archivoDisenoInicialUrl: "https://pixel.test/disenos/gorra.png",
      esDisenoGeneral: false,
    },
  ];
  const service = new PublicCotizacionService();

  const calculado = await service.calcular({ items });
  const creado = await service.crearCotizacion({
    cliente: {
      nombre: cliente.nombre,
      correo: cliente.correo,
      telefono: cliente.telefono,
    },
    items,
  }, {
    idUsuario: 77,
    rol: "Cliente",
  });
  const payload = crearCotizacionMock.mock.calls[0]?.arguments[0];

  assert.equal(calculado.items.length, 2);
  assert.equal(calculado.items[0].tecnica.nombre, "DTF");
  assert.equal(calculado.items[1].idTecnica, 6);
  assert.equal(calculado.items[1].tecnica.nombre, "Sublimacion");
  assert.equal(calculado.detalles.length, 2);
  assert.equal(calculado.cantidadItems, 2);
  assert.equal(calculado.productosResumen, "Camiseta, Gorra");
  assert.equal(calculado.subtotalBruto, 648000);
  assert.equal(calculado.descuentoTotal, 79713);
  assert.equal(calculado.subtotalConDescuento, 568287);
  assert.equal(calculado.subtotalFinal, 568287);
  assert.equal(payload.detalles.length, 2);
  assert.equal(payload.detalles[0].idTecnica, 5);
  assert.equal(payload.detalles[1].idTecnica, 6);
  assert.equal(payload.detalles[0].requiereDiseno, false);
  assert.equal(payload.detalles[1].origenDiseno, "CLIENTE");
  assert.equal(
    payload.detalles[1].archivoDisenoInicialUrl,
    "https://pixel.test/disenos/gorra.png",
  );
  assert.equal(payload.total, 568287);
  assert.equal(creado.calculo.items.length, 2);
  assert.equal(creado.cotizacion.cantidadItems, 2);
  assert.equal(creado.cotizacion.productosResumen, "Camiseta, Gorra");
  assert.equal(creado.cotizacion.subtotalFinal, 568287);
  const correo = sendMailMock.mock.calls[0]?.arguments[0];
  assert.ok(correo);
  assert.match(correo.text, /Tecnica: DTF/);
  assert.match(correo.text, /Tecnica: Sublimacion/);
});

test("PublicCotizacionService exige login si el correo ya existe y no crea duplicados", async (t) => {
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculo);
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreo",
    async () => cliente,
  );
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => ({
    idUsuario: 77,
    correo: cliente.correo,
  }));
  const buscarIdentidadMock = t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => {
      throw new Error("No debe continuar buscando o reutilizando clientes.");
    },
  );
  const crearClienteMock = t.mock.method(
    ClienteRepository.prototype,
    "crearCliente",
    async () => {
      throw new Error("No debe crear clientes duplicados.");
    },
  );
  const crearCotizacionMock = t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async () => {
      throw new Error("No debe crear la cotizacion sin login.");
    },
  );
  const asegurarAccesoMock = t.mock.method(
    ClienteAccessService.prototype,
    "asegurarAccesoCliente",
    async () => {
      throw new Error("No debe crear usuarios duplicados.");
    },
  );

  await assert.rejects(
    () =>
      new PublicCotizacionService().crearCotizacion({
        cliente: {
          nombre: cliente.nombre,
          correo: cliente.correo,
          telefono: cliente.telefono,
        },
        items: [{ idProducto: 1, idTecnica: 5, cantidad: 12 }],
      }),
    (error: any) => {
      assert.equal(error.code, "EMAIL_REQUIRES_LOGIN");
      assert.equal(
        error.message,
        "Este correo ya est\u00e1 registrado. Inicia sesi\u00f3n para realizar una cotizaci\u00f3n con esta cuenta.",
      );
      return true;
    },
  );

  assert.equal(buscarIdentidadMock.mock.calls.length, 0);
  assert.equal(crearClienteMock.mock.calls.length, 0);
  assert.equal(crearCotizacionMock.mock.calls.length, 0);
  assert.equal(asegurarAccesoMock.mock.calls.length, 0);
});

test("PublicCotizacionService no usa un Admin autenticado como Cliente", async (t) => {
  t.mock.method(ProductoService.prototype, "calcularItems", async () => calculo);
  t.mock.method(TecnicaRepository.prototype, "buscarPorId", async () => tecnica);
  t.mock.method(ClienteRepository.prototype, "buscarPorCorreo", async () => null);
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => ({
    idUsuario: 77,
    correo: cliente.correo,
  }));
  const obtenerClienteMock = t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => {
      throw new Error("No debe resolver al Admin como Cliente.");
    },
  );
  const crearCotizacionMock = t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async () => {
      throw new Error("No debe crear la cotizacion con la cuenta existente.");
    },
  );

  await assert.rejects(
    () =>
      new PublicCotizacionService().crearCotizacion(
        {
          cliente: {
            nombre: cliente.nombre,
            correo: cliente.correo,
            telefono: cliente.telefono,
          },
          items: [{ idProducto: 1, idTecnica: 5, cantidad: 12 }],
        },
        { idUsuario: 1, rol: "Admin" },
      ),
    (error: any) => {
      assert.equal(error.code, "EMAIL_REQUIRES_LOGIN");
      return true;
    },
  );

  assert.equal(obtenerClienteMock.mock.calls.length, 0);
  assert.equal(crearCotizacionMock.mock.calls.length, 0);
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
