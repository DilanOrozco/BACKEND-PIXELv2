import crypto, { randomUUID } from "node:crypto";
import path from "node:path";
import {
  eliminarAssetCloudinary,
  subirBufferCloudinary,
} from "./cloudinary-asset-storage.service";

export type PaymentReceiptUploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type StoredPaymentReceipt = {
  secureUrl: string;
  publicId: string;
  originalName: string;
  mimeType: string;
  format: string;
  sizeBytes: number;
  resourceType: string;
  sha256: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

export class PaymentReceiptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentReceiptValidationError";
    Object.setPrototypeOf(this, PaymentReceiptValidationError.prototype);
  }
}

export class PaymentReceiptStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentReceiptStorageError";
    Object.setPrototypeOf(this, PaymentReceiptStorageError.prototype);
  }
}

const obtenerLimiteMb = () => {
  const valor = Number(process.env.MAX_PAYMENT_RECEIPT_SIZE_MB ?? 10);
  return Number.isFinite(valor) && valor > 0 ? valor : 10;
};

const detectarMimeReal = (buffer: Buffer) => {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  return null;
};

const limpiarNombreOriginal = (nombre: string) => {
  const nombreBase = path.basename(String(nombre ?? "comprobante"));
  const nombreSeguro = nombreBase.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (nombreSeguro || "comprobante").slice(0, 255);
};

export const validarArchivoComprobante = (file: PaymentReceiptUploadFile) => {
  if (!file?.buffer?.length || !Number.isFinite(file.size) || file.size <= 0) {
    throw new PaymentReceiptValidationError("El comprobante esta vacio.");
  }

  const limiteMb = obtenerLimiteMb();
  if (file.size > limiteMb * 1024 * 1024) {
    throw new PaymentReceiptValidationError(
      `El comprobante supera el tamano maximo permitido de ${limiteMb} MB.`,
    );
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const mimeEsperado = MIME_BY_EXTENSION[extension];
  const mimeReal = detectarMimeReal(file.buffer);

  if (
    !mimeEsperado ||
    !mimeReal ||
    mimeEsperado !== mimeReal ||
    file.mimetype !== mimeReal
  ) {
    throw new PaymentReceiptValidationError(
      "Formato de comprobante no permitido.",
    );
  }

  return {
    originalName: limpiarNombreOriginal(file.originalname),
    mimeType: mimeReal,
    format: extension === ".jpeg" ? "jpg" : extension.slice(1),
    sizeBytes: file.size,
    sha256: crypto.createHash("sha256").update(file.buffer).digest("hex"),
  };
};

export class CloudinaryPaymentReceiptStorageService {
  async savePaymentReceipt(
    file: PaymentReceiptUploadFile,
    context: { idCliente: number; idPedido: number },
  ): Promise<StoredPaymentReceipt> {
    const validado = validarArchivoComprobante(file);

    try {
      const resultado = await subirBufferCloudinary(file.buffer, {
        folder: `pixel/comprobantes-abonos/pedido-${context.idPedido}`,
        publicId: `comprobante-${randomUUID()}`,
        allowedFormats: ["jpg", "jpeg", "png", "pdf"],
      });

      return {
        secureUrl: resultado.secure_url,
        publicId: resultado.public_id,
        originalName: validado.originalName,
        mimeType: validado.mimeType,
        format: String(resultado.format ?? validado.format).toLowerCase(),
        sizeBytes: Number(resultado.bytes ?? validado.sizeBytes),
        resourceType: String(resultado.resource_type ?? "auto"),
        sha256: validado.sha256,
      };
    } catch {
      throw new PaymentReceiptStorageError(
        "No pudimos almacenar el comprobante. Intenta nuevamente.",
      );
    }
  }

  async deletePaymentReceipt(publicId: string, resourceType: string) {
    if (!publicId) {
      return false;
    }

    try {
      await eliminarAssetCloudinary(publicId, resourceType);
      return true;
    } catch {
      console.warn("No fue posible limpiar un comprobante recien almacenado.");
      return false;
    }
  }
}
