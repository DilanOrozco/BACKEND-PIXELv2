import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  eliminarAssetCloudinary,
  subirBufferCloudinary,
} from "./cloudinary-asset-storage.service";

export type DesignUploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type StoredDesignFile = {
  secureUrl: string;
  publicId: string;
  originalName: string;
  mimeType: string;
  format: string;
  sizeBytes: number;
  resourceType: string;
};

const MAX_DESIGN_FILE_SIZE_MB = 10;
const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export class DesignFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignFileValidationError";
    Object.setPrototypeOf(this, DesignFileValidationError.prototype);
  }
}

export class DesignFileStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignFileStorageError";
    Object.setPrototypeOf(this, DesignFileStorageError.prototype);
  }
}

const obtenerLimiteMb = () => {
  const valor = Number(process.env.MAX_DESIGN_FILE_SIZE_MB ?? 10);
  return Number.isFinite(valor) && valor > 0
    ? Math.min(valor, MAX_DESIGN_FILE_SIZE_MB)
    : MAX_DESIGN_FILE_SIZE_MB;
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

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  return null;
};

const limpiarNombreOriginal = (nombre: string) => {
  const nombreBase = path.basename(String(nombre ?? "archivo"));
  const nombreSeguro = nombreBase.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (nombreSeguro || "archivo").slice(0, 255);
};

export const validarArchivoDiseno = (file: DesignUploadFile) => {
  if (!file?.buffer?.length || !Number.isFinite(file.size) || file.size <= 0) {
    throw new DesignFileValidationError("El archivo esta vacio.");
  }

  const limiteMb = obtenerLimiteMb();
  if (file.size > limiteMb * 1024 * 1024) {
    throw new DesignFileValidationError(
      `El archivo supera el tamano maximo permitido de ${limiteMb} MB.`,
    );
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const mimeEsperado = MIME_BY_EXTENSION[extension];
  const mimeReal = detectarMimeReal(file.buffer);

  if (!mimeEsperado || !mimeReal || mimeEsperado !== mimeReal || file.mimetype !== mimeReal) {
    throw new DesignFileValidationError(
      "Solo puedes subir imagenes JPG, PNG, WEBP o archivos PDF.",
    );
  }

  return {
    mimeType: mimeReal,
    originalName: limpiarNombreOriginal(file.originalname),
    extension: extension === ".jpeg" ? "jpg" : extension.slice(1),
  };
};

export class CloudinaryDesignStorageService {
  async subirDiseno(file: DesignUploadFile, idPedido: number): Promise<StoredDesignFile> {
    const archivoValidado = validarArchivoDiseno(file);

    try {
      const resultado = await subirBufferCloudinary(file.buffer, {
        folder: `pixel/disenos/pedido-${idPedido}`,
        publicId: `diseno-${randomUUID()}`,
        allowedFormats: ["jpg", "jpeg", "png", "webp", "pdf"],
      });

      return {
        secureUrl: resultado.secure_url,
        publicId: resultado.public_id,
        originalName: archivoValidado.originalName,
        mimeType: archivoValidado.mimeType,
        format: String(resultado.format ?? archivoValidado.extension).toLowerCase(),
        sizeBytes: Number(resultado.bytes ?? file.size),
        resourceType: String(resultado.resource_type ?? "auto"),
      };
    } catch {
      throw new DesignFileStorageError(
        "No pudimos almacenar el archivo. Intenta nuevamente.",
      );
    }
  }

  async eliminarRecienSubido(publicId: string, resourceType: string) {
    if (!publicId) {
      return false;
    }

    try {
      await eliminarAssetCloudinary(publicId, resourceType);
      return true;
    } catch {
      console.warn("No fue posible limpiar un archivo de diseno recien subido.");
      return false;
    }
  }
}
