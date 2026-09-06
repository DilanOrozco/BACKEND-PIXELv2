import test from "node:test";
import assert from "node:assert/strict";
import {
  PaymentReceiptValidationError,
  validarArchivoComprobante,
  type PaymentReceiptUploadFile,
} from "./cloudinary-payment-receipt-storage.service";

const archivo = (
  originalname: string,
  mimetype: string,
  buffer: Buffer,
  size = buffer.length,
): PaymentReceiptUploadFile => ({
  originalname,
  mimetype,
  buffer,
  size,
});

test("CloudinaryPaymentReceiptStorage valida JPG, PNG y PDF por firma real", () => {
  const casos = [
    archivo("pago.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    archivo(
      "pago.png",
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    archivo("pago.pdf", "application/pdf", Buffer.from("%PDF-1.7", "ascii")),
  ];

  assert.deepEqual(
    casos.map((item) => validarArchivoComprobante(item).mimeType),
    ["image/jpeg", "image/png", "application/pdf"],
  );
  assert.ok(
    casos.every(
      (item) => validarArchivoComprobante(item).sha256.length === 64,
    ),
  );
});

test("CloudinaryPaymentReceiptStorage rechaza formato o MIME disfrazado", () => {
  assert.throws(
    () =>
      validarArchivoComprobante(
        archivo("pago.png", "image/png", Buffer.from("archivo-falso")),
      ),
    PaymentReceiptValidationError,
  );
  assert.throws(
    () =>
      validarArchivoComprobante(
        archivo("pago.pdf", "application/pdf", Buffer.from([0xff, 0xd8, 0xff])),
      ),
    /Formato de comprobante no permitido/,
  );
});

test("CloudinaryPaymentReceiptStorage respeta el limite configurado", (t) => {
  const anterior = process.env.MAX_PAYMENT_RECEIPT_SIZE_MB;
  process.env.MAX_PAYMENT_RECEIPT_SIZE_MB = "10";
  t.after(() => {
    if (anterior === undefined) delete process.env.MAX_PAYMENT_RECEIPT_SIZE_MB;
    else process.env.MAX_PAYMENT_RECEIPT_SIZE_MB = anterior;
  });

  assert.throws(
    () =>
      validarArchivoComprobante(
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

test("CloudinaryPaymentReceiptStorage limpia el nombre original", () => {
  const resultado = validarArchivoComprobante(
    archivo("../carpeta/pago\u0000.png", "image/png", Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])),
  );

  assert.equal(resultado.originalName, "pago.png");
  assert.equal(resultado.format, "png");
});
