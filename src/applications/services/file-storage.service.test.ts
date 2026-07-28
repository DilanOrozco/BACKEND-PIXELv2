import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileStorageService } from "./file-storage.service";

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

test("FileStorageService guarda comprobantes con ruta relativa segura", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pixel-storage-"));
  const previousRoot = process.env.UPLOADS_ROOT_PATH;
  process.env.UPLOADS_ROOT_PATH = root;

  try {
    const service = new FileStorageService();
    const stored = await service.savePaymentReceipt(
      {
        buffer: pngBuffer,
        originalname: "../comprobante.png",
        mimetype: "image/png",
        size: pngBuffer.length,
      },
      { idCliente: 4, idPedido: 9 },
    );
    const metadata = await service.getFileMetadata(stored.relativePath);

    assert.equal(path.isAbsolute(stored.relativePath), false);
    assert.match(
      stored.relativePath,
      /^comprobantes\/cliente-4\/pedido-9\/abono-/,
    );
    assert.equal(stored.originalName, "comprobante.png");
    assert.equal(stored.mimeType, "image/png");
    assert.equal(metadata.sizeBytes, pngBuffer.length);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.UPLOADS_ROOT_PATH;
    } else {
      process.env.UPLOADS_ROOT_PATH = previousRoot;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("FileStorageService valida y guarda comprobantes JPG reales", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pixel-storage-"));
  const previousRoot = process.env.UPLOADS_ROOT_PATH;
  process.env.UPLOADS_ROOT_PATH = root;

  try {
    const stored = await new FileStorageService().savePaymentReceipt(
      {
        buffer: jpegBuffer,
        originalname: "comprobante.jpg",
        mimetype: "image/jpeg",
        size: jpegBuffer.length,
      },
      { idCliente: 4, idPedido: 9 },
    );

    assert.equal(stored.mimeType, "image/jpeg");
    assert.match(stored.safeName, /\.jpg$/);
    assert.equal(stored.sizeBytes, jpegBuffer.length);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.UPLOADS_ROOT_PATH;
    } else {
      process.env.UPLOADS_ROOT_PATH = previousRoot;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("FileStorageService rechaza MIME falso, tamano excesivo y path traversal", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pixel-storage-"));
  const previousRoot = process.env.UPLOADS_ROOT_PATH;
  const previousMax = process.env.MAX_PAYMENT_RECEIPT_SIZE_MB;
  process.env.UPLOADS_ROOT_PATH = root;
  process.env.MAX_PAYMENT_RECEIPT_SIZE_MB = "0.000001";

  try {
    const service = new FileStorageService();

    await assert.rejects(
      () =>
        service.savePaymentReceipt(
          {
            buffer: pngBuffer,
            originalname: "comprobante.jpg",
            mimetype: "image/jpeg",
            size: pngBuffer.length,
          },
          { idCliente: 1, idPedido: 1 },
        ),
      /supera el limite|no coincide/,
    );
    assert.throws(
      () => service.resolveSafePath("../secreto.txt"),
      /Ruta de archivo no valida/,
    );
    assert.throws(
      () => service.resolveSafePath(path.resolve(root, "archivo.png")),
      /Ruta de archivo no valida/,
    );
  } finally {
    if (previousRoot === undefined) {
      delete process.env.UPLOADS_ROOT_PATH;
    } else {
      process.env.UPLOADS_ROOT_PATH = previousRoot;
    }
    if (previousMax === undefined) {
      delete process.env.MAX_PAYMENT_RECEIPT_SIZE_MB;
    } else {
      process.env.MAX_PAYMENT_RECEIPT_SIZE_MB = previousMax;
    }
    await rm(root, { recursive: true, force: true });
  }
});
