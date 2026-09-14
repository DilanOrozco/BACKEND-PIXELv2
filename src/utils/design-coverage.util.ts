export type TipoObjetivoDiseno =
  | "ESTAMPADO"
  | "PRODUCTO_GENERAL"
  | "PEDIDO_GENERAL"
  | "GRUPO_COMPARTIDO"
  | "LEGACY_PRODUCTO";

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

const origenRequerimiento = (origen: unknown) => {
  const valor = String(origen ?? "PENDIENTE_DEFINIR").toUpperCase();
  if (valor === "CLIENTE") return "CLIENTE";
  if (valor === "NO_REQUIERE") return "NO_REQUIERE";
  if (["PIXEL", "DISENADOR", "ADMIN"].includes(valor)) return "PIXEL";
  return "PENDIENTE_DEFINIR";
};

const combinarOrigenes = (estampados: any[]) => {
  const origenes = new Set(
    estampados.map((estampado) =>
      origenRequerimiento(estampado.origenDiseno),
    ),
  );
  return origenes.size === 1
    ? [...origenes][0]
    : "PENDIENTE_DEFINIR";
};

const nombreProducto = (detalle: any) =>
  detalle.producto?.nombre ??
  detalle.nombrePersonalizado ??
  detalle.descripcion ??
  "Producto";

const resumenEstampado = (detalle: any, estampado: any) => ({
  idEstampadoPedido: estampado.idDetalleEstampadoPedido,
  idDetalleEstampadoPedido: estampado.idDetalleEstampadoPedido,
  idDetallePedido: detalle.idDetallePedido,
  producto: nombreProducto(detalle),
  ubicacion: estampado.ubicacion,
  tecnica: estampado.tecnica?.nombre ?? "No especificada",
  idTecnica: estampado.idTecnica ?? null,
  anchoCm: estampado.anchoCm ?? null,
  altoCm: estampado.altoCm ?? null,
  descripcion: estampado.descripcion ?? null,
  observaciones: estampado.observaciones ?? null,
  origenDiseno: origenRequerimiento(estampado.origenDiseno),
  grupoDisenoCompartido: estampado.grupoDisenoCompartido ?? null,
});

const claveObjetivoDiseno = (
  diseno: any,
  detallePorId: Map<number, any>,
  estampadoPorId: Map<number, any>,
  unicoDetalleLegacy: number | null,
) => {
  const idDetalle = Number(diseno.idDetallePedido ?? 0);
  const idEstampado = Number(diseno.idDetalleEstampadoPedido ?? 0);
  const estampado = estampadoPorId.get(idEstampado);
  const grupo =
    String(
      diseno.grupoDisenoCompartido ??
        estampado?.grupoDisenoCompartido ??
        "",
    ).trim() || null;

  if (diseno.esDisenoGeneral && idDetalle > 0) {
    return `PRODUCTO:${idDetalle}`;
  }
  if (diseno.esDisenoGeneral) {
    return "PEDIDO:GENERAL";
  }
  if (grupo) {
    return `GRUPO:${grupo}`;
  }
  if (idEstampado > 0) {
    return `ESTAMPADO:${idEstampado}`;
  }
  if (idDetalle > 0) {
    return detallePorId.get(idDetalle)?.estampados?.length
      ? `PRODUCTO:${idDetalle}`
      : `LEGACY:${idDetalle}`;
  }
  return unicoDetalleLegacy ? `LEGACY:${unicoDetalleLegacy}` : null;
};

const estadoRequerimiento = (
  origen: string,
  vigente: any,
  cobertura: any,
  tieneArchivoCliente: boolean,
  tipo: TipoObjetivoDiseno,
  cubiertoPorPedidoGeneral: boolean,
  cubiertoPorProductoGeneral: boolean,
) => {
  if (cobertura?.estado === "APROBADO") {
    if (cubiertoPorPedidoGeneral) {
      return "CUBIERTO_POR_DISENO_GENERAL_PEDIDO";
    }
    if (cubiertoPorProductoGeneral || tipo === "PRODUCTO_GENERAL") {
      return "CUBIERTO_POR_DISENO_GENERAL_PRODUCTO";
    }
    if (tipo === "GRUPO_COMPARTIDO") {
      return "CUBIERTO_POR_DISENO_COMPARTIDO";
    }
    return "DISENO_APROBADO";
  }
  if (vigente?.estado === "RECHAZADO") return "PENDIENTE_CORRECCION";
  if (vigente?.estado === "ENVIADO") {
    return vigente.origenDiseno === "CLIENTE"
      ? "PENDIENTE_REVISION_CLIENTE"
      : "PENDIENTE_APROBACION";
  }
  if (vigente?.estado === "PENDIENTE") return "EN_CREACION";
  if (origen === "CLIENTE") {
    return tieneArchivoCliente
      ? "PENDIENTE_REVISION_CLIENTE"
      : "PENDIENTE_RECEPCION_CLIENTE";
  }
  if (origen === "PIXEL") return "PENDIENTE_CREACION_PIXEL";
  return "PENDIENTE_DEFINIR_ORIGEN";
};

export const resolverRequerimientosDiseno = (
  idPedido: number,
  detalles: any[],
  disenos: any[] = [],
) => {
  const detallesRequeridos = detalles.filter(
    (detalle) => detalle.requiereDiseno !== false,
  );
  const detallePorId = new Map(
    detalles.map((detalle) => [Number(detalle.idDetallePedido), detalle]),
  );
  const estampadosConDetalle = detalles.flatMap((detalle) =>
    (detalle.estampados ?? []).map((estampado: any) => ({
      ...estampado,
      idDetallePedido: detalle.idDetallePedido,
      detalle,
    })),
  );
  const estampadoPorId = new Map(
    estampadosConDetalle.map((estampado) => [
      Number(estampado.idDetalleEstampadoPedido),
      estampado,
    ]),
  );
  const unicoDetalleLegacy =
    detallesRequeridos.length === 1 &&
    (detallesRequeridos[0]?.estampados ?? []).length === 0
      ? Number(detallesRequeridos[0].idDetallePedido)
      : null;
  const versionesOrdenadas = ordenarVersiones(disenos);
  const versionesPorClave = new Map<string, any[]>();

  for (const diseno of versionesOrdenadas) {
    const clave = claveObjetivoDiseno(
      diseno,
      detallePorId,
      estampadoPorId,
      unicoDetalleLegacy,
    );
    if (!clave) continue;
    versionesPorClave.set(clave, [
      ...(versionesPorClave.get(clave) ?? []),
      diseno,
    ]);
  }

  const grupos = new Map<string, any[]>();
  for (const estampado of estampadosConDetalle) {
    if (
      origenRequerimiento(estampado.origenDiseno) === "NO_REQUIERE" ||
      !estampado.grupoDisenoCompartido
    ) {
      continue;
    }
    grupos.set(estampado.grupoDisenoCompartido, [
      ...(grupos.get(estampado.grupoDisenoCompartido) ?? []),
      estampado,
    ]);
  }

  const bases: any[] = [];
  for (const [grupo, estampados] of grupos) {
    bases.push({
      idRequerimientoDiseno: `GROUP-${grupo}`,
      clave: `GRUPO:${grupo}`,
      tipo: "GRUPO_COMPARTIDO" as TipoObjetivoDiseno,
      idPedido,
      idDetallePedido:
        new Set(estampados.map((item) => item.idDetallePedido)).size === 1
          ? estampados[0]?.idDetallePedido
          : null,
      idEstampadoPedido: null,
      grupoDisenoCompartido: grupo,
      producto: {
        nombre:
          new Set(estampados.map((item) => nombreProducto(item.detalle)))
            .size === 1
            ? nombreProducto(estampados[0]?.detalle)
            : `${estampados.length} estampados compartidos`,
      },
      estampadosCubiertos: estampados.map((item) =>
        resumenEstampado(item.detalle, item),
      ),
      origenDiseno: combinarOrigenes(estampados),
      tieneArchivoCliente: estampados.some(
        (item) => item.detalle.archivoDisenoInicialUrl,
      ),
    });
  }

  for (const detalle of detallesRequeridos) {
    const todosLosEstampados = detalle.estampados ?? [];
    const estampados = (detalle.estampados ?? []).filter(
      (estampado: any) =>
        origenRequerimiento(estampado.origenDiseno) !== "NO_REQUIERE",
    );
    if (estampados.length === 0) {
      if (todosLosEstampados.length > 0) {
        continue;
      }
      bases.push({
        idRequerimientoDiseno: `LEGACY-${detalle.idDetallePedido}`,
        clave: `LEGACY:${detalle.idDetallePedido}`,
        tipo: "LEGACY_PRODUCTO" as TipoObjetivoDiseno,
        idPedido,
        idDetallePedido: detalle.idDetallePedido,
        idEstampadoPedido: null,
        grupoDisenoCompartido: null,
        producto: { nombre: nombreProducto(detalle) },
        estampadosCubiertos: [],
        origenDiseno: origenRequerimiento(detalle.origenDiseno),
        tieneArchivoCliente: Boolean(detalle.archivoDisenoInicialUrl),
      });
      continue;
    }

    const sinGrupo = estampados.filter(
      (estampado: any) => !estampado.grupoDisenoCompartido,
    );
    if (detalle.esDisenoGeneral && sinGrupo.length > 0) {
      bases.push({
        idRequerimientoDiseno: `PRODUCT-${detalle.idDetallePedido}`,
        clave: `PRODUCTO:${detalle.idDetallePedido}`,
        tipo: "PRODUCTO_GENERAL" as TipoObjetivoDiseno,
        idPedido,
        idDetallePedido: detalle.idDetallePedido,
        idEstampadoPedido: null,
        grupoDisenoCompartido: null,
        producto: { nombre: nombreProducto(detalle) },
        estampadosCubiertos: sinGrupo.map((estampado: any) =>
          resumenEstampado(detalle, estampado),
        ),
        origenDiseno: combinarOrigenes(sinGrupo),
        tieneArchivoCliente: Boolean(detalle.archivoDisenoInicialUrl),
      });
      continue;
    }

    for (const estampado of sinGrupo) {
      bases.push({
        idRequerimientoDiseno: `STAMP-${estampado.idDetalleEstampadoPedido}`,
        clave: `ESTAMPADO:${estampado.idDetalleEstampadoPedido}`,
        tipo: "ESTAMPADO" as TipoObjetivoDiseno,
        idPedido,
        idDetallePedido: detalle.idDetallePedido,
        idEstampadoPedido: estampado.idDetalleEstampadoPedido,
        grupoDisenoCompartido: null,
        producto: { nombre: nombreProducto(detalle) },
        estampadosCubiertos: [resumenEstampado(detalle, estampado)],
        origenDiseno: origenRequerimiento(estampado.origenDiseno),
        tieneArchivoCliente: Boolean(detalle.archivoDisenoInicialUrl),
      });
    }
  }

  const pedidoGeneral = versionesPorClave.get("PEDIDO:GENERAL")?.[0] ?? null;
  const requerimientos = bases.map((base) => {
    const versiones = versionesPorClave.get(base.clave) ?? [];
    const vigente = versiones[0] ?? null;
    const detalleGeneral = base.idDetallePedido
      ? versionesPorClave.get(`PRODUCTO:${base.idDetallePedido}`)?.[0] ?? null
      : null;
    const candidatosCobertura = [
      vigente,
      detalleGeneral,
      pedidoGeneral,
    ].filter((diseno, indice, lista) =>
      diseno &&
      lista.findIndex((item) => item?.idDiseno === diseno.idDiseno) === indice,
    );
    const cobertura = candidatosCobertura.find(
      (diseno) => diseno.estado === "APROBADO",
    );
    const estado = estadoRequerimiento(
      base.origenDiseno,
      vigente,
      cobertura,
      base.tieneArchivoCliente,
      base.tipo,
      Boolean(
        cobertura &&
          pedidoGeneral &&
          cobertura.idDiseno === pedidoGeneral.idDiseno,
      ),
      Boolean(
        cobertura &&
          detalleGeneral &&
          cobertura.idDiseno === detalleGeneral.idDiseno &&
          base.tipo !== "PRODUCTO_GENERAL",
      ),
    );
    const cubierto = Boolean(cobertura);
    const activo = vigente && vigente.estado !== "RECHAZADO";

    return {
      idRequerimientoDiseno: base.idRequerimientoDiseno,
      tipo: base.tipo,
      idPedido,
      idDetallePedido: base.idDetallePedido,
      idEstampadoPedido: base.idEstampadoPedido,
      idDetalleEstampadoPedido: base.idEstampadoPedido,
      grupoDisenoCompartido: base.grupoDisenoCompartido,
      producto: base.producto,
      estampadosCubiertos: base.estampadosCubiertos,
      origenDiseno: base.origenDiseno,
      estadoCoberturaDiseno: estado,
      cubiertoPorDiseno: cubierto,
      disenoVigente: vigente,
      disenoCobertura: cobertura ?? null,
      versiones,
      puedeCrearDiseno:
        !cubierto &&
        !activo &&
        base.origenDiseno === "PIXEL",
      puedeCargarCorreccion:
        !cubierto && vigente?.estado === "RECHAZADO",
      puedeRegistrarDisenoCliente:
        !cubierto &&
        !activo &&
        base.origenDiseno === "CLIENTE",
      puedeDefinirOrigen:
        !cubierto &&
        !activo &&
        base.origenDiseno === "PENDIENTE_DEFINIR",
      puedeAprobar:
        vigente?.estado === "PENDIENTE" ||
        vigente?.estado === "ENVIADO",
    };
  });

  const aprobados = requerimientos.filter(
    (requerimiento) => requerimiento.cubiertoPorDiseno,
  ).length;

  return {
    requerimientos,
    resumen: {
      totalDisenosRequeridos: requerimientos.length,
      totalDisenosAprobados: aprobados,
      totalDisenosPendientes: Math.max(
        requerimientos.length - aprobados,
        0,
      ),
      estadoCoberturaDiseno:
        requerimientos.length === 0 || aprobados === requerimientos.length
          ? "COMPLETA"
          : aprobados > 0
            ? "PARCIAL"
            : "PENDIENTE",
    },
  };
};

export const agregarCoberturaDisenoADetalles = (
  detalles: any[],
  disenos: any[] = [],
) => {
  const idPedido = Number(
    detalles[0]?.idPedido ?? disenos[0]?.idPedido ?? 0,
  );
  const resolucion = resolverRequerimientosDiseno(
    idPedido,
    detalles,
    disenos,
  );

  return detalles.map((detalle) => {
    if (detalle.requiereDiseno === false) {
      return {
        ...detalle,
        diseno: null,
        requerimientosDiseno: [],
        estadoCoberturaDiseno: "NO_REQUIERE_DISENO",
        mensajeEstadoDiseno: "No requiere diseno.",
        cubiertoPorDiseno: true,
      };
    }
    const requerimientos = resolucion.requerimientos.filter(
      (requerimiento) =>
        requerimiento.idDetallePedido === detalle.idDetallePedido ||
        requerimiento.estampadosCubiertos.some(
          (estampado: any) =>
            estampado.idDetallePedido === detalle.idDetallePedido,
        ),
    );
    const estampados = (detalle.estampados ?? []).map((estampado: any) => {
      if (origenRequerimiento(estampado.origenDiseno) === "NO_REQUIERE") {
        return {
          ...estampado,
          diseno: null,
          cubiertoPorDiseno: true,
          estadoCoberturaDiseno: "NO_REQUIERE_DISENO",
          puedeCrearDiseno: false,
        };
      }
      const requerimiento = requerimientos.find((item) =>
        item.estampadosCubiertos.some(
          (cubierto: any) =>
            Number(cubierto.idEstampadoPedido) ===
            Number(estampado.idDetalleEstampadoPedido),
        ),
      );
      return {
        ...estampado,
        diseno:
          requerimiento?.disenoCobertura ??
          requerimiento?.disenoVigente ??
          null,
        cubiertoPorDiseno: requerimiento?.cubiertoPorDiseno ?? false,
        estadoCoberturaDiseno:
          requerimiento?.estadoCoberturaDiseno ??
          "PENDIENTE_DEFINIR_ORIGEN",
        puedeCrearDiseno: requerimiento?.puedeCrearDiseno ?? false,
        puedeCargarCorreccion:
          requerimiento?.puedeCargarCorreccion ?? false,
      };
    });
    const cubierto =
      requerimientos.length === 0 ||
      requerimientos.every((item) => item.cubiertoPorDiseno);
    const diseno =
      requerimientos.find((item) => item.disenoCobertura)?.disenoCobertura ??
      requerimientos.find((item) => item.disenoVigente)?.disenoVigente ??
      null;

    const estadoPendienteLegacy = (() => {
      const estado = requerimientos[0]?.estadoCoberturaDiseno;
      if (estado === "PENDIENTE_REVISION_CLIENTE") {
        return "DISENO_ENTREGADO_POR_CLIENTE";
      }
      if (estado === "PENDIENTE_CORRECCION") {
        return "DISENO_RECHAZADO";
      }
      if (estado === "PENDIENTE_APROBACION") {
        return "DISENO_ENVIADO";
      }
      return estado ?? "PENDIENTE_CREACION_PIXEL";
    })();

    return {
      ...detalle,
      estampados,
      diseno,
      requerimientosDiseno: requerimientos,
      estadoCoberturaDiseno: cubierto
        ? diseno?.esDisenoGeneral
          ? "CUBIERTO_POR_DISENO_GENERAL"
          : estampados.length > 0
          ? "ESTAMPADOS_CUBIERTOS"
          : "DISENO_APROBADO"
        : estadoPendienteLegacy,
      mensajeEstadoDiseno: cubierto
        ? "Todos los requerimientos de diseno estan cubiertos."
        : "Existen requerimientos de diseno pendientes.",
      cubiertoPorDiseno: cubierto,
    };
  });
};

export const resumirCoberturaDisenos = (detalles: any[]) => {
  const requerimientos = detalles.flatMap(
    (detalle) => detalle.requerimientosDiseno ?? [],
  );
  const unicos = new Map(
    requerimientos.map((item: any) => [
      item.idRequerimientoDiseno,
      item,
    ]),
  );
  if (unicos.size > 0) {
    const aprobados = [...unicos.values()].filter(
      (item: any) => item.cubiertoPorDiseno,
    ).length;
    return {
      totalDisenosRequeridos: unicos.size,
      totalDisenosAprobados: aprobados,
      totalDisenosPendientes: Math.max(unicos.size - aprobados, 0),
    };
  }

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
  if (detalles.length === 0) return true;
  if (disenos.some((diseno) => diseno.esDisenoGeneral)) return true;
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
