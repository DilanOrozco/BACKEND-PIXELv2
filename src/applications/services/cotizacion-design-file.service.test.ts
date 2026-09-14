import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionDesignFileService } from "./cotizacion-design-file.service";
import { CloudinaryDesignStorageService } from "./cloudinary-design-storage.service";

const file = (nombre: string): Express.Multer.File => ({
  fieldname: "archivoDiseno",
  originalname: nombre,
  encoding: "7bit",
  mimetype: "image/png",
  size: 8,
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  destination: "",
  filename: "",
  path: "",
  stream: null as any,
});

const almacenado = (sufijo: string) => ({
  secureUrl: `https://res.cloudinary.test/${sufijo}.png`,
  publicId: `pixel/cotizaciones/disenos/${sufijo}`,
  originalName: `${sufijo}.png`,
  mimeType: "image/png",
  format: "png",
  sizeBytes: 8,
  resourceType: "image",
});

test("asocia un archivo compartido a varios productos y conserva estampados", async (t) => {
  t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDisenoCotizacion",
    async () => almacenado("compartido"),
  );

  const data = {
    items: [
      {
        idProducto: 1,
        origenDiseno: "CLIENTE",
        archivoDisenoIndice: 0,
        estampados: [
          { origenDiseno: "CLIENTE", grupoDisenoCompartido: "LOGO" },
          { origenDiseno: "CLIENTE", grupoDisenoCompartido: "LOGO" },
        ],
      },
      {
        idProducto: 2,
        origenDiseno: "CLIENTE",
        archivoDisenoIndice: 0,
        estampados: [
          { origenDiseno: "CLIENTE", grupoDisenoCompartido: "LOGO" },
        ],
      },
      {
        idProducto: 3,
        origenDiseno: "PIXEL",
        estampados: [{ origenDiseno: "PIXEL" }],
      },
    ],
  };

  const resultado = await new CotizacionDesignFileService().adjuntarArchivos(
    data,
    [file("logo.png")],
  );

  assert.equal(resultado.data.items[0].archivoDisenoInicialUrl, almacenado("compartido").secureUrl);
  assert.equal(resultado.data.items[1].archivoDisenoInicialUrl, almacenado("compartido").secureUrl);
  assert.equal(resultado.data.items[2].archivoDisenoInicialUrl, undefined);
  assert.equal(resultado.data.items[0].estampados.length, 2);
  assert.equal(resultado.archivosSubidos.length, 1);
});

test("no exige archivo cuando PIXEL crea el diseno", async () => {
  const data = {
    items: [
      { idProducto: 1, origenDiseno: "PIXEL", estampados: [] },
      { idProducto: 2, origenDiseno: "NO_REQUIERE", estampados: [] },
    ],
  };

  const resultado = await new CotizacionDesignFileService().adjuntarArchivos(data);
  assert.deepEqual(resultado.data, data);
  assert.deepEqual(resultado.archivosSubidos, []);
});

test("rechaza archivos sin mapeo y formatos invalidos antes de Cloudinary", async (t) => {
  const upload = t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDisenoCotizacion",
    async () => almacenado("no-debe-subir"),
  );
  const service = new CotizacionDesignFileService();

  await assert.rejects(
    service.adjuntarArchivos(
      { items: [{ origenDiseno: "CLIENTE" }, { origenDiseno: "CLIENTE" }] },
      [file("sin-mapeo.png")],
    ),
    /referenciado/,
  );

  await assert.rejects(
    service.adjuntarArchivos(
      { items: [{ origenDiseno: "CLIENTE", archivoDisenoIndice: 0 }] },
      [{ ...file("mal.exe"), mimetype: "application/octet-stream" }],
    ),
    /Solo puedes subir/,
  );
  assert.equal(upload.mock.callCount(), 0);
});

test("si Cloudinary falla parcialmente limpia los assets creados", async (t) => {
  t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "subirDisenoCotizacion",
    async (archivo) => {
      if (archivo.originalname === "dos.png") throw new Error("cloudinary");
      return almacenado("uno");
    },
  );
  const cleanup = t.mock.method(
    CloudinaryDesignStorageService.prototype,
    "eliminarRecienSubido",
    async () => true,
  );

  await assert.rejects(
    new CotizacionDesignFileService().adjuntarArchivos(
      {
        items: [
          { origenDiseno: "CLIENTE", archivoDisenoIndice: 0 },
          { origenDiseno: "CLIENTE", archivoDisenoIndice: 1 },
        ],
      },
      [file("uno.png"), file("dos.png")],
    ),
    /No pudimos almacenar/,
  );
  assert.equal(cleanup.mock.callCount(), 1);
});
