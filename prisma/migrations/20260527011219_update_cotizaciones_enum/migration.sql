/*
  Warnings:

  - SOLICITADA and COTIZADA are migrated to PENDIENTE.
  - RECHAZADA is migrated to ANULADA because the state no longer exists.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoCotizacion_new" AS ENUM ('PENDIENTE', 'APROBADA', 'ANULADA');
ALTER TABLE "public"."cotizaciones" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" TYPE "EstadoCotizacion_new" USING (
  CASE "estado"::text
    WHEN 'SOLICITADA' THEN 'PENDIENTE'
    WHEN 'COTIZADA' THEN 'PENDIENTE'
    WHEN 'RECHAZADA' THEN 'ANULADA'
    ELSE "estado"::text
  END
)::"EstadoCotizacion_new";
ALTER TYPE "EstadoCotizacion" RENAME TO "EstadoCotizacion_old";
ALTER TYPE "EstadoCotizacion_new" RENAME TO "EstadoCotizacion";
DROP TYPE "public"."EstadoCotizacion_old";
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;
