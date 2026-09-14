import type { NextFunction, Response } from "express";
import multer from "multer";
import type { AuthRequest } from "./auth.middleware";

const maxSizeMb = Number(process.env.MAX_PAYMENT_RECEIPT_SIZE_MB ?? 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
      (Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 10) *
      1024 *
      1024,
    files: 1,
  },
});

export const uploadPaymentReceipt = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  upload.single("archivo")(req, res, (error: unknown) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "El comprobante supera el tamano maximo permitido."
        : "No fue posible procesar el archivo adjunto.";

    return res.status(400).json({ message });
  });
};

const configuredMaxDesignSizeMb = Number(
  process.env.MAX_DESIGN_FILE_SIZE_MB ?? 10,
);
const maxDesignSizeMb =
  Number.isFinite(configuredMaxDesignSizeMb) && configuredMaxDesignSizeMb > 0
    ? Math.min(configuredMaxDesignSizeMb, 10)
    : 10;
const designUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxDesignSizeMb * 1024 * 1024,
    files: 1,
  },
});

export const uploadDesignFile = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  designUpload.single("archivo")(req, res, (error: unknown) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? `El archivo supera el tamano maximo permitido de ${maxDesignSizeMb} MB.`
        : "No fue posible procesar el archivo de diseno.";

    return res.status(400).json({ message });
  });
};

const maxQuoteDesignFiles = 50;
const quoteDesignUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxDesignSizeMb * 1024 * 1024,
    files: maxQuoteDesignFiles,
  },
});

export const uploadQuoteDesignFiles = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.is("multipart/form-data")) {
    return next();
  }

  quoteDesignUpload.array("archivoDiseno", maxQuoteDesignFiles)(
    req,
    res,
    (error: unknown) => {
      if (error) {
        const message =
          error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? `El archivo supera el tamano maximo permitido de ${maxDesignSizeMb} MB.`
            : error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT"
              ? `Solo puedes adjuntar hasta ${maxQuoteDesignFiles} archivos de diseno.`
              : "No fue posible procesar los archivos de diseno.";

        return res.status(400).json({ message });
      }

      const payload = req.body?.payload;
      if (typeof payload !== "string" || payload.trim() === "") {
        return res.status(400).json({
          message:
            "El multipart debe incluir el campo payload con la cotizacion en JSON.",
        });
      }

      try {
        const parsed = JSON.parse(payload);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("INVALID_PAYLOAD");
        }
        req.body = parsed;
        return next();
      } catch {
        return res.status(400).json({
          message: "El campo payload debe contener un objeto JSON valido.",
        });
      }
    },
  );
};
