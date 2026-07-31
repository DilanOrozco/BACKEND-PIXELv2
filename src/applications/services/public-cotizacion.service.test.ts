import test from "node:test";
import assert from "node:assert/strict";
import { PublicCotizacionService } from "./public-cotizacion.service";
import { EmailService } from "./email.service";
import { ClienteAccessService } from "./cliente-access.service";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { ProductoRepository } from "../../infrastructure/repositories/producto.repository";
import { TarifaTecnicaRepository } from "../../infrastructure/repositories/tarifa-tecnica.repository";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";

const cliente = {
  idCliente: 10,
  idUsuario: 77,
  nombre: "Ana Cliente",
  documento: null,
  correo: "ana@pixel.test",
  telefono: "3001234567",
  direccion: null,
  estado: true,
};

const producto = {
  idProducto: 1,
  nombre: "Camiseta",
  descripcion: "Camiseta de algodon",
  precioBase: null,
  requiereDiseno: true,
  categoriaProducto: {
    idCategoriaProducto: 1,
    nombre: "Textiles",
  },
  rangos: [
    { idRango: 1, cantidadMin: 1, descuentoPorcentaje: 0, estado: true },
    { idRango: 2, cantidadMin: 12, descuentoPorcentaje: 10, estado: true },
  ],
};

const configurarCalculo = (t: any) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [producto],
  );
  return t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [
      {
        idTecnica: 5,
        nombre: "DTF",
        tarifas: [
          {
            idTarifa: 1,
            idTecnica: 5,
            anchoHastaCm: 20,
            altoHastaCm: 20,
            precioUnitario: 10000,
            estado: true,
          },
          {
            idTarifa: 2,
            idTecnica: 5,
            anchoHastaCm: 30,
            altoHastaCm: 30,
            precioUnitario: 15000,
            estado: true,
          },
        ],
        descuentos: [
          {
            idDescuento: 1,
            idTecnica: 5,
            cantidadMinima: 1,
            porcentaje: 0,
            estado: true,
          },
          {
            idDescuento: 2,
            idTecnica: 5,
            cantidadMinima: 12,
            porcentaje: 10,
            estado: true,
          },
        ],
      },
    ],
  );
};

const item = {
  idProducto: 1,
  cantidad: 12,
  observaciones: "Talla M",
  estampados: [
    {
      idTecnica: 5,
      ubicacion: "FRENTE",
      anchoCm: 11,
      altoCm: 12,
      origenDiseno: "PIXEL",
    },
  ],
};

test("calculo publico valida la solicitud pero no expone precios internos", async (t) => {
  const configuracionMock = configurarCalculo(t);
  const respuesta = await new PublicCotizacionService().calcular({
    items: [item],
  });

  assert.equal(respuesta.estado, "EN_REVISION");
  assert.equal(respuesta.estadoPrecio, "PENDIENTE_CONFIRMACION");
  assert.equal(respuesta.items.length, 1);
  assert.equal(respuesta.items[0].estampados[0].tecnica.nombre, "DTF");
  assert.equal(respuesta.items[0].estampados[0].anchoCm, 11);
  assert.equal("precioSugeridoInterno" in respuesta, false);
  assert.equal("total" in respuesta, false);
  assert.equal("precioUnitario" in respuesta.items[0].estampados[0], false);
  assert.equal(configuracionMock.mock.calls.length, 1);
});

test("solicitud publica guarda sugerencia interna y devuelve una vista sin precios", async (t) => {
  configurarCalculo(t);
  t.mock.method(ClienteRepository.prototype, "buscarPorCorreo", async () => null);
  t.mock.method(UsuarioRepository.prototype, "buscarPorCorreo", async () => null);
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreoOTelefono",
    async () => null,
  );
  t.mock.method(
    ClienteRepository.prototype,
    "crearCliente",
    async () => cliente,
  );
  t.mock.method(
    ClienteAccessService.prototype,
    "asegurarAccesoCliente",
    async () => ({
      usuarioCreado: true,
      usuarioExistente: false,
      idUsuario: 77,
      linkCrearPassword: "https://pixel.test/crear-password-cliente/token",
    }),
  );
  const crearMock = t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async (data: any) => ({
      idCotizacion: 99,
      ...data,
      cliente,
      versiones: [],
    }),
  );
  const emailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const respuesta = await new PublicCotizacionService().crearCotizacion({
    cliente: {
      nombre: cliente.nombre,
      correo: cliente.correo,
      telefono: cliente.telefono,
    },
    items: [item],
    observaciones: "Solicitud de prueba",
  });
  const persistido = crearMock.mock.calls[0]?.arguments[0];

  assert.equal(persistido.estado, "EN_REVISION");
  assert.equal(persistido.subtotal, 0);
  assert.equal(persistido.total, 0);
  assert.equal(Number(persistido.precioSugeridoInterno), 108000);
  assert.equal(persistido.detalles[0].precioBase, null);
  assert.equal(persistido.detalles[0].idRangoDescuentoAplicado, 2);
  assert.equal(persistido.detalles[0].cantidadMinimaDescuentoSnapshot, 12);
  assert.equal(Number(persistido.detalles[0].descuentoPorcentaje), 10);
  assert.equal(Number(persistido.detalles[0].subtotalBruto), 120000);
  assert.equal(Number(persistido.detalles[0].descuentoTotal), 12000);
  assert.equal(
    Number(persistido.detalles[0].subtotalConDescuento),
    108000,
  );
  assert.equal(Number(persistido.detalles[0].subtotalSugeridoInterno), 108000);
  assert.equal(persistido.detalles[0].estampados[0].idTarifaAplicada, 1);
  assert.equal(respuesta.cotizacion.estadoPrecio, "PENDIENTE_CONFIRMACION");
  assert.equal("precioSugeridoInterno" in respuesta.cotizacion, false);
  assert.equal("total" in respuesta.cotizacion, false);
  assert.ok(emailMock.mock.calls.length >= 1);
  const correo = emailMock.mock.calls
    .map((call) => call.arguments[0])
    .find((mensaje) => mensaje?.to === cliente.correo);
  assert.ok(correo);
  assert.match(correo!.text, /revisara la solicitud y confirmara el precio/i);
  assert.match(correo!.text, /crear-password-cliente\/token/);
  assert.doesNotMatch(correo!.text, /\$|108\.000|108000/);
});

test("correo existente sin sesion exige login y no crea duplicados", async (t) => {
  configurarCalculo(t);
  t.mock.method(
    ClienteRepository.prototype,
    "buscarPorCorreo",
    async () => cliente,
  );
  t.mock.method(
    UsuarioRepository.prototype,
    "buscarPorCorreo",
    async () => ({ idUsuario: 77 }),
  );
  const crearMock = t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async () => {
      throw new Error("No debe crear la cotizacion.");
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
        items: [item],
      }),
    (error: any) => error.code === "EMAIL_REQUIRES_LOGIN",
  );
  assert.equal(crearMock.mock.calls.length, 0);
});

test("cliente autenticado cotiza con su Cliente real", async (t) => {
  configurarCalculo(t);
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => cliente,
  );
  const crearMock = t.mock.method(
    CotizacionRepository.prototype,
    "crearCotizacionConDetalles",
    async (data: any) => ({
      idCotizacion: 100,
      ...data,
      cliente,
      versiones: [],
    }),
  );
  t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: false, skipped: true }),
  );

  await new PublicCotizacionService().crearCotizacion(
    {
      cliente: {
        nombre: "Cliente suplantado",
        correo: "otro@pixel.test",
        telefono: "3110000000",
      },
      items: [item],
    },
    { idUsuario: 77, rol: "Cliente" },
  );

  assert.equal(crearMock.mock.calls[0]?.arguments[0].idCliente, 10);
});

test("producto OTRO y servicio sin tarifa quedan en revision sin ser rechazados", async (t) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [],
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [
      {
        idTecnica: 5,
        nombre: "DTF",
        tarifas: [],
        descuentos: [],
      },
    ],
  );

  const respuesta = await new PublicCotizacionService().calcular({
    items: [
      {
        tipoProducto: "OTRO",
        nombrePersonalizado: "Bolso especial",
        cantidad: 2,
        estampados: [
          {
            idTecnica: 5,
            ubicacion: "FRENTE",
            anchoCm: 80,
            altoCm: 80,
          },
        ],
      },
    ],
  });

  assert.equal(respuesta.estado, "EN_REVISION");
  assert.equal(respuesta.items[0].tipoProducto, "OTRO");
  assert.equal(respuesta.requiereRevisionManual, true);
  assert.equal("total" in respuesta, false);
});

test("producto OTRO sin tecnica todavia se recibe para revision manual", async (t) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [],
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [],
  );

  const respuesta = await new PublicCotizacionService().calcular({
    items: [
      {
        tipoProducto: "OTRO",
        nombrePersonalizado: "Producto artesanal especial",
        descripcionPersonalizada: "Material por confirmar con el cliente",
        cantidad: 3,
      },
    ],
  });

  assert.equal(respuesta.estado, "EN_REVISION");
  assert.equal(respuesta.items[0].tipoProducto, "OTRO");
  assert.equal(respuesta.items[0].estampados.length, 0);
  assert.equal(respuesta.requiereRevisionManual, true);
  assert.equal("precioSugeridoInterno" in respuesta, false);
  assert.equal("total" in respuesta, false);
});

test("medidas null se aceptan para revision y una sola medida falla", async (t) => {
  configurarCalculo(t);
  const service = new PublicCotizacionService();
  const respuesta = await service.calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 1,
        estampados: [
          {
            idTecnica: 5,
            ubicacion: "FRENTE",
            anchoCm: null,
            altoCm: null,
          },
        ],
      },
    ],
  });

  assert.equal(respuesta.requiereRevisionManual, true);
  assert.equal(
    respuesta.items[0].estampados[0].requiereRevisionManual,
    true,
  );
  assert.equal("motivosRevision" in respuesta.items[0].estampados[0], false);

  await assert.rejects(
    () =>
      service.calcular({
        items: [
          {
            idProducto: 1,
            cantidad: 1,
            estampados: [
              {
                idTecnica: 5,
                ubicacion: "FRENTE",
                anchoCm: 10,
              },
            ],
          },
        ],
      }),
    /ancho y alto juntos/i,
  );
});

test("tecnica pendiente no rechaza la solicitud ni expone el motivo interno", async (t) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [producto],
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [],
  );

  const respuesta = await new PublicCotizacionService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 2,
        estampados: [
          {
            ubicacion: "FRENTE",
            anchoCm: null,
            altoCm: null,
          },
        ],
      },
    ],
  });

  assert.equal(respuesta.requiereRevisionManual, true);
  assert.equal(respuesta.items[0].estampados[0].idTecnica, null);
  assert.equal("motivosRevision" in respuesta.items[0].estampados[0], false);
});

test("calculo publico conserva tres productos y cinco estampados en su orden", async (t) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async (ids: number[]) =>
      ids.map((idProducto) => ({
        idProducto,
        nombre: `Producto ${idProducto}`,
        descripcion: null,
        precioBase: null,
        requiereDiseno: true,
        categoriaProducto: null,
        rangos: [
          {
            idRango: idProducto,
            cantidadMin: 1,
            descuentoPorcentaje: 0,
            estado: true,
          },
        ],
      })),
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [5, 6].map((idTecnica) => ({
      idTecnica,
      nombre: idTecnica === 5 ? "DTF" : "Bordado",
      requiereMedidas: true,
      tarifas: [
        {
          idTarifa: idTecnica,
          anchoHastaCm: 50,
          altoHastaCm: 50,
          precioUnitario: 10000,
        },
      ],
      descuentos: [],
    })),
  );
  const cincoEstampados = Array.from({ length: 5 }, (_, indice) => ({
    idTecnica: indice % 2 === 0 ? 5 : 6,
    ubicacion: `UBICACION-${indice + 1}`,
    anchoCm: 10 + indice,
    altoCm: 12 + indice,
    origenDiseno: "CLIENTE",
    grupoDisenoCompartido:
      indice < 2 ? "GRUPO-COMPARTIDO" : undefined,
  }));

  const respuesta = await new PublicCotizacionService().calcular({
    items: [
      { idProducto: 1, cantidad: 2, estampados: cincoEstampados },
      {
        idProducto: 2,
        cantidad: 3,
        estampados: [
          {
            idTecnica: 5,
            ubicacion: "FRENTE",
            anchoCm: 10,
            altoCm: 10,
            origenDiseno: "CLIENTE",
            grupoDisenoCompartido: "GRUPO-COMPARTIDO",
          },
        ],
      },
      {
        idProducto: 3,
        cantidad: 4,
        estampados: [
          {
            idTecnica: 6,
            ubicacion: "ESPALDA",
            anchoCm: 20,
            altoCm: 20,
            origenDiseno: "NO_REQUIERE",
          },
        ],
      },
    ],
  });
  const serializada = JSON.stringify(respuesta);

  assert.equal(respuesta.items.length, 3);
  assert.equal(respuesta.items[0].estampados.length, 5);
  assert.deepEqual(
    respuesta.items[0].estampados.map((item: any) => item.ubicacion),
    cincoEstampados.map((item) => item.ubicacion),
  );
  assert.equal(
    respuesta.items[1].estampados[0].grupoDisenoCompartido,
    "GRUPO-COMPARTIDO",
  );
  assert.doesNotMatch(
    serializada,
    /precioUnitario|precioSugerido|subtotal|descuento|tarifa/i,
  );
});
