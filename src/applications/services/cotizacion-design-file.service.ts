import {
  CloudinaryDesignStorageService,
  DesignFileStorageError,
  validarArchivoDiseno,
  type StoredDesignFile,
} from "./cloudinary-design-storage.service";

const storageService = new CloudinaryDesignStorageService();

type ResultadoArchivosCotizacion = {
  data: any;
  archivosSubidos: StoredDesignFile[];
};

const obtenerItems = (data: any): any[] =>
  Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.detalles)
      ? data.detalles
      : [];

const aportaDiseno = (item: any) =>
  String(item?.origenDiseno ?? "").toUpperCase() === "CLIENTE" ||
  (Array.isArray(item?.estampados) &&
    item.estampados.some(
      (estampado: any) =>
        String(estampado?.origenDiseno ?? "").toUpperCase() === "CLIENTE",
    ));

const indiceArchivo = (valor: unknown) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const indice = Number(valor);
  if (!Number.isInteger(indice) || indice < 0) {
    throw new Error("archivoDisenoIndice debe ser un entero mayor o igual a 0.");
  }
  return indice;
};

const limpiarCamposArchivoInternos = (item: any) => {
  const {
    archivoDisenoIndice: _indice,
    archivoDisenoInicialMetadata: _metadata,
    ...itemSeguro
  } = item ?? {};
  return itemSeguro;
};

const reemplazarItems = (data: any, items: any[]) => ({
  ...data,
  ...(Array.isArray(data?.items) ? { items } : { detalles: items }),
});

export class CotizacionDesignFileService {
  async adjuntarArchivos(
    data: any,
    files: Express.Multer.File[] = [],
  ): Promise<ResultadoArchivosCotizacion> {
    const items = obtenerItems(data);
    let indices: Array<number | null> = items.map((item) =>
      indiceArchivo(item?.archivoDisenoIndice),
    );

    if (files.length === 1 && indices.every((indice) => indice === null)) {
      const candidatos = items
        .map((item, indice) => ({ item, indice }))
        .filter(({ item }) => aportaDiseno(item));
      if (candidatos.length === 1) {
        const indiceCandidato = candidatos[0]!.indice;
        indices = indices.map((indice, posicion) =>
          posicion === indiceCandidato ? 0 : indice,
        );
      }
    }

    if (files.length === 0) {
      if (indices.some((indice) => indice !== null)) {
        throw new Error(
          "La cotizacion referencia archivoDisenoIndice pero no adjunta archivoDiseno.",
        );
      }
      return {
        data: reemplazarItems(data, items.map(limpiarCamposArchivoInternos)),
        archivosSubidos: [],
      };
    }

    const indicesUsados = new Set<number>();
    indices.forEach((indice, posicionItem) => {
      if (indice === null) return;
      if (indice >= files.length) {
        throw new Error(
          `El archivoDisenoIndice del producto ${posicionItem} no existe en archivoDiseno.`,
        );
      }
      if (!aportaDiseno(items[posicionItem])) {
        throw new Error(
          `El producto ${posicionItem} solo puede adjuntar archivo cuando el origen del diseno es CLIENTE.`,
        );
      }
      indicesUsados.add(indice);
    });

    if (indicesUsados.size !== files.length) {
      throw new Error(
        "Cada archivoDiseno adjunto debe estar referenciado por archivoDisenoIndice en al menos un producto.",
      );
    }

    files.forEach((file) => validarArchivoDiseno(file));

    const resultados = await Promise.allSettled(
      files.map((file) => storageService.subirDisenoCotizacion(file)),
    );
    const archivosSubidos = resultados.flatMap((resultado) =>
      resultado.status === "fulfilled" ? [resultado.value] : [],
    );

    if (archivosSubidos.length !== files.length) {
      await this.limpiarArchivos(archivosSubidos);
      throw new DesignFileStorageError(
        "No pudimos almacenar los archivos de la cotizacion. Intenta nuevamente.",
      );
    }

    const itemsConArchivo = items.map((item, posicionItem) => {
      const indice = indices[posicionItem] ?? null;
      if (indice === null) {
        return limpiarCamposArchivoInternos(item);
      }

      const archivo = archivosSubidos[indice]!;
      return {
        ...limpiarCamposArchivoInternos(item),
        archivoDisenoInicialUrl: archivo.secureUrl,
        archivoDisenoInicialMetadata: archivo,
        medioRecepcionDiseno: "SISTEMA",
      };
    });

    return {
      data: reemplazarItems(data, itemsConArchivo),
      archivosSubidos,
    };
  }

  async limpiarArchivos(archivos: StoredDesignFile[]) {
    await Promise.allSettled(
      archivos.map((archivo) =>
        storageService.eliminarRecienSubido(
          archivo.publicId,
          archivo.resourceType,
        ),
      ),
    );
  }
}
