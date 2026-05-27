-- Switch physical deletes from restrictive foreign keys to database-level cascades.
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_id_rol_fkey";
ALTER TABLE "cotizaciones" DROP CONSTRAINT "cotizaciones_id_cliente_fkey";
ALTER TABLE "cotizaciones" DROP CONSTRAINT "cotizaciones_creado_por_id_fkey";
ALTER TABLE "detalle_cotizacion" DROP CONSTRAINT "detalle_cotizacion_id_cotizacion_fkey";
ALTER TABLE "detalle_cotizacion" DROP CONSTRAINT "detalle_cotizacion_id_tecnica_fkey";

ALTER TABLE "usuarios"
ADD CONSTRAINT "usuarios_id_rol_fkey"
FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cotizaciones"
ADD CONSTRAINT "cotizaciones_id_cliente_fkey"
FOREIGN KEY ("id_cliente") REFERENCES "usuarios"("id_usuario")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cotizaciones"
ADD CONSTRAINT "cotizaciones_creado_por_id_fkey"
FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id_usuario")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "detalle_cotizacion"
ADD CONSTRAINT "detalle_cotizacion_id_cotizacion_fkey"
FOREIGN KEY ("id_cotizacion") REFERENCES "cotizaciones"("id_cotizacion")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "detalle_cotizacion"
ADD CONSTRAINT "detalle_cotizacion_id_tecnica_fkey"
FOREIGN KEY ("id_tecnica") REFERENCES "tecnicas"("id_tecnica")
ON DELETE CASCADE ON UPDATE CASCADE;
