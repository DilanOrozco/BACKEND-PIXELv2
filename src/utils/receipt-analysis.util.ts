export const describirOrigenAnalisis = (valor: unknown) => {
  const origen = String(valor ?? "").toUpperCase();

  if (origen.includes("FRONTEND")) {
    return {
      codigo: "PORTAL_CLIENTE",
      etiqueta: "Enviado desde el portal del cliente",
    };
  }

  if (origen.includes("BACKEND") || origen.includes("OCR")) {
    return {
      codigo: "PROCESAMIENTO_INTERNO",
      etiqueta: "Procesamiento interno",
    };
  }

  if (origen.includes("MANUAL")) {
    return {
      codigo: "REVISION_MANUAL",
      etiqueta: "Revision manual",
    };
  }

  return {
    codigo: "NO_ESPECIFICADO",
    etiqueta: "No especificado",
  };
};
