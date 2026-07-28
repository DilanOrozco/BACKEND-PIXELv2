const fechaDiseno = (diseno: any) => {
  const fecha = new Date(
    diseno?.fechaActualizacion ??
      diseno?.fechaCreacion ??
      diseno?.fechaEnvio ??
      0,
  ).getTime();

  return Number.isNaN(fecha) ? 0 : fecha;
};

const ordenarVersiones = (disenos: any[]) =>
  [...disenos].sort(
    (a, b) =>
      fechaDiseno(b) - fechaDiseno(a) ||
      Number(b?.idDiseno ?? 0) - Number(a?.idDiseno ?? 0),
  );

const estadoDesdeDiseno = (diseno: any, esGeneral = false) => {
  if (diseno?.estado === "APROBADO") {
    return esGeneral
      ? "CUBIERTO_POR_DISENO_GENERAL"
      : "DISENO_APROBADO";
  }

  if (
    diseno?.estado === "ENVIADO" &&
    String(diseno?.origenDiseno).toUpperCase() === "CLIENTE"
  ) {
    return esGeneral
      ? "DISENO_GENERAL_ENTREGADO_POR_CLIENTE"
      : "DISENO_ENTREGADO_POR_CLIENTE";
  }

  const prefijo = esGeneral ? "DISENO_GENERAL_" : "DISENO_";
  return `${prefijo}${String(diseno?.estado ?? "PENDIENTE").toUpperCase()}`;
};

export const agregarCoberturaDisenoADetalles = (
  detalles: any[],
  disenos: any[] = [],
) => {
  const detallesRequeridos = detalles.filter(
    (detalle) => detalle.requiereDiseno !== false,
  );
  const versiones = ordenarVersiones(disenos);
  const disenoGeneralVigente = versiones.find(
    (diseno) => diseno.esDisenoGeneral,
  );
  const legadoVigente =
    detallesRequeridos.length === 1
      ? versiones.find(
          (diseno) =>
            diseno.idDetallePedido === null && !diseno.esDisenoGeneral,
        )
      : null;

  return detalles.map((detalle) => {
    if (detalle.requiereDiseno === false) {
      return {
        ...detalle,
        diseno: null,
        estadoCoberturaDiseno: "NO_REQUIERE_DISENO",
        mensajeEstadoDiseno: "No requiere diseno.",
        cubiertoPorDiseno: true,
      };
    }

    const disenoEspecificoVigente =
      versiones.find(
        (diseno) =>
          !diseno.esDisenoGeneral &&
          Number(diseno.idDetallePedido) === Number(detalle.idDetallePedido),
      ) ??
      (Number(detalle.idDetallePedido) ===
      Number(detallesRequeridos[0]?.idDetallePedido)
        ? legadoVigente
        : null);

    if (disenoEspecificoVigente?.estado === "APROBADO") {
      return {
        ...detalle,
        diseno: disenoEspecificoVigente,
        estadoCoberturaDiseno: "DISENO_APROBADO",
        mensajeEstadoDiseno: "Diseno especifico aprobado.",
        cubiertoPorDiseno: true,
      };
    }

    if (disenoGeneralVigente?.estado === "APROBADO") {
      return {
        ...detalle,
        diseno: disenoGeneralVigente,
        estadoCoberturaDiseno: "CUBIERTO_POR_DISENO_GENERAL",
        mensajeEstadoDiseno: "Cubierto por un diseno general aprobado.",
        cubiertoPorDiseno: true,
      };
    }

    const disenoRelacionado =
      disenoEspecificoVigente ?? disenoGeneralVigente;

    if (disenoRelacionado) {
      const esGeneral = Boolean(disenoRelacionado.esDisenoGeneral);

      return {
        ...detalle,
        diseno: disenoRelacionado,
        estadoCoberturaDiseno: estadoDesdeDiseno(
          disenoRelacionado,
          esGeneral,
        ),
        mensajeEstadoDiseno:
          disenoRelacionado.estado === "RECHAZADO"
            ? "El diseno vigente fue rechazado y requiere una nueva version."
            : esGeneral
              ? "El diseno general esta pendiente de aprobacion."
              : "El diseno del producto esta pendiente de aprobacion.",
        cubiertoPorDiseno: false,
      };
    }

    const origenCliente =
      String(detalle.origenDiseno ?? "PIXEL").toUpperCase() === "CLIENTE";
    const tieneArchivoCliente = Boolean(detalle.archivoDisenoInicialUrl);

    return {
      ...detalle,
      diseno: null,
      estadoCoberturaDiseno: origenCliente
        ? tieneArchivoCliente
          ? "DISENO_CLIENTE_PENDIENTE_VINCULACION"
          : "PENDIENTE_ARCHIVO_CLIENTE"
        : "PENDIENTE_CREACION_PIXEL",
      mensajeEstadoDiseno: origenCliente
        ? tieneArchivoCliente
          ? "El cliente entrego un diseno pendiente de vinculacion."
          : "Pendiente de que el cliente entregue el diseno."
        : "PIXEL debe crear y enviar el diseno.",
      cubiertoPorDiseno: false,
    };
  });
};

export const resumirCoberturaDisenos = (detalles: any[]) => {
  const requeridos = detalles.filter(
    (detalle) => detalle.requiereDiseno !== false,
  );
  const aprobados = requeridos.filter(
    (detalle) => detalle.cubiertoPorDiseno === true,
  );

  return {
    totalDisenosRequeridos: requeridos.length,
    totalDisenosAprobados: aprobados.length,
    totalDisenosPendientes: Math.max(
      requeridos.length - aprobados.length,
      0,
    ),
  };
};

export const evaluarCoberturaDisenosAprobados = (
  detalles: Array<{ idDetallePedido: number }>,
  disenos: Array<{
    idDetallePedido: number | null;
    esDisenoGeneral: boolean;
  }>,
) => {
  if (detalles.length === 0) {
    return true;
  }

  if (disenos.some((diseno) => diseno.esDisenoGeneral)) {
    return true;
  }

  if (
    detalles.length === 1 &&
    disenos.some((diseno) => diseno.idDetallePedido === null)
  ) {
    return true;
  }

  const detallesAprobados = new Set(
    disenos
      .map((diseno) => diseno.idDetallePedido)
      .filter((id): id is number => id !== null),
  );

  return detalles.every((detalle) =>
    detallesAprobados.has(detalle.idDetallePedido),
  );
};
