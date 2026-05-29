/*
  Warnings:

  - SOLICITADA and COTIZADA are migrated to PENDIENTE.
  - APROBADA is migrated to APROVADA to match the enum value used by this migration.
  - ANULADA is migrated to RECHAZADA because the state no longer exists.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoCotizacion_new" AS ENUM ('PENDIENTE', 'APROVADA', 'RECHAZADA');
ALTER TABLE "public"."cotizaciones" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" TYPE "EstadoCotizacion_new" USING (
  CASE "estado"::text
    WHEN 'SOLICITADA' THEN 'PENDIENTE'
    WHEN 'COTIZADA' THEN 'PENDIENTE'
    WHEN 'APROBADA' THEN 'APROVADA'
    WHEN 'ANULADA' THEN 'RECHAZADA'
    ELSE "estado"::text
  END
)::"EstadoCotizacion_new";
ALTER TYPE "EstadoCotizacion" RENAME TO "EstadoCotizacion_old";
ALTER TYPE "EstadoCotizacion_new" RENAME TO "EstadoCotizacion";
DROP TYPE "public"."EstadoCotizacion_old";
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;
