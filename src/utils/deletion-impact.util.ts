export type DeletionImpactAction = "ELIMINAR" | "DESVINCULAR" | "ACTUALIZAR";

export type DeletionImpactRecord = {
  id: number;
  nombre: string;
};

export type DeletionImpactGroup = {
  tipo: string;
  accion: DeletionImpactAction;
  cantidad: number;
  registros: DeletionImpactRecord[];
  registrosOmitidos: number;
};

export type DeletionImpact = {
  puedeEliminar: boolean;
  requiereConfirmacionReforzada: boolean;
  totalAfectados: number;
  limiteRegistrosPorTipo: number;
  afectados: DeletionImpactGroup[];
  motivoBloqueo?: string;
};

export type DeletionImpactOptions = {
  puedeEliminar?: boolean;
  motivoBloqueo?: string;
};

export const DELETION_IMPACT_RECORD_LIMIT = 10;

export const buildDeletionImpact = (
  groups: Omit<DeletionImpactGroup, "registrosOmitidos">[],
  options: DeletionImpactOptions | undefined = {},
): DeletionImpact => {
  const afectados = groups
    .filter((group) => group.cantidad > 0)
    .map((group) => ({
      ...group,
      registrosOmitidos: Math.max(0, group.cantidad - group.registros.length),
    }));
  const totalAfectados = afectados.reduce(
    (total, group) => total + group.cantidad,
    0,
  );

  return {
    puedeEliminar: options?.puedeEliminar ?? true,
    requiereConfirmacionReforzada: totalAfectados > 0,
    totalAfectados,
    limiteRegistrosPorTipo: DELETION_IMPACT_RECORD_LIMIT,
    afectados,
    ...(options?.motivoBloqueo
      ? { motivoBloqueo: options.motivoBloqueo }
      : {}),
  };
};
