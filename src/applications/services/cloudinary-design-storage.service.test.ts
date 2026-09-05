import test from "node:test";
import assert from "node:assert/strict";
import {
  DesignFileValidationError,
  validarArchivoDiseno,
  type DesignUploadFile,
} from "./cloudinary-design-storage.service";

const archivo = (
  originalname: string,
  mimetype: string,
  buffer: Buffer,
  size = buffer.length,
): DesignUploadFile => ({
  originalname,
  mimetype,
  buffer,
  size,
});

test("CloudinaryDesignStorage valida JPG, PNG, WEBP y PDF por firma real", () => {
  const casos = [
    archivo("diseno.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    archivo(
      "diseno.png",
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    archivo(
      "diseno.webp",
      "image/webp",
      Buffer.from("RIFF0000WEBP", "ascii"),
    ),
    archivo("diseno.pdf", "application/pdf", Buffer.from("%PDF-1.7", "ascii")),
  ];

  assert.deepEqual(
    casos.map((item) => validarArchivoDiseno(item).mimeType),
    ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  );
});

test("CloudinaryDesignStorage rechaza extension, MIME o firma inconsistentes", () => {
  assert.throws(
    () =>
      validarArchivoDiseno(
        archivo("diseno.png", "image/png", Buffer.from("archivo-falso")),
      ),
    DesignFileValidationError,
  );
  assert.throws(
    () =>
      validarArchivoDiseno(
        archivo("diseno.pdf", "application/pdf", Buffer.from([0xff, 0xd8, 0xff])),
      ),
    /Solo puedes subir/,
  );
});

test("CloudinaryDesignStorage limita los archivos de diseno a 10 MB", (t) => {
  const anterior = process.env.MAX_DESIGN_FILE_SIZE_MB;
  process.env.MAX_DESIGN_FILE_SIZE_MB = "25";
  t.after(() => {
    if (anterior === undefined) delete process.env.MAX_DESIGN_FILE_SIZE_MB;
    else process.env.MAX_DESIGN_FILE_SIZE_MB = anterior;
  });

  assert.throws(
    () =>
      validarArchivoDiseno(
        archivo(
          "grande.jpg",
          "image/jpeg",
          Buffer.from([0xff, 0xd8, 0xff]),
          10 * 1024 * 1024 + 1,
        ),
      ),
    /10 MB/,
  );
});

test("CloudinaryDesignStorage conserva solo un nombre original seguro", () => {
  const resultado = validarArchivoDiseno(
    archivo("../carpeta/diseno\u0000.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff])),
  );

  assert.equal(resultado.originalName, "diseno.jpg");
  assert.equal(resultado.extension, "jpg");
});
