-- Refuerza borrados fisicos de usuarios sin perder trazabilidad innecesaria.

-- Un rol es dato maestro: no debe borrar usuarios al eliminarse.
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_id_rol_fkey";
ALTER TABLE "usuarios"
ADD CONSTRAINT "usuarios_id_rol_fkey"
FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Si se elimina el usuario que creo la cotizacion, se conserva la cotizacion.
ALTER TABLE "cotizaciones" DROP CONSTRAINT "cotizaciones_creado_por_id_fkey";
ALTER TABLE "cotizaciones" ALTER COLUMN "creado_por_id" DROP NOT NULL;
ALTER TABLE "cotizaciones"
ADD CONSTRAINT "cotizaciones_creado_por_id_fkey"
FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Si se elimina un cliente, sus pedidos y dependientes se eliminan con el.
ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_id_cliente_fkey";
ALTER TABLE "pedidos"
ADD CONSTRAINT "pedidos_id_cliente_fkey"
FOREIGN KEY ("id_cliente") REFERENCES "usuarios"("id_usuario")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_id_cotizacion_fkey";
ALTER TABLE "pedidos"
ADD CONSTRAINT "pedidos_id_cotizacion_fkey"
FOREIGN KEY ("id_cotizacion") REFERENCES "cotizaciones"("id_cotizacion")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "detalle_pedido" DROP CONSTRAINT "detalle_pedido_id_pedido_fkey";
ALTER TABLE "detalle_pedido"
ADD CONSTRAINT "detalle_pedido_id_pedido_fkey"
FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "abonos" DROP CONSTRAINT "abonos_id_pedido_fkey";
ALTER TABLE "abonos"
ADD CONSTRAINT "abonos_id_pedido_fkey"
FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "abonos" DROP CONSTRAINT "abonos_confirmado_por_id_fkey";
ALTER TABLE "abonos"
ADD CONSTRAINT "abonos_confirmado_por_id_fkey"
FOREIGN KEY ("confirmado_por_id") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "abonos" DROP CONSTRAINT "abonos_rechazado_por_id_fkey";
ALTER TABLE "abonos"
ADD CONSTRAINT "abonos_rechazado_por_id_fkey"
FOREIGN KEY ("rechazado_por_id") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "disenos" DROP CONSTRAINT "disenos_id_pedido_fkey";
ALTER TABLE "disenos"
ADD CONSTRAINT "disenos_id_pedido_fkey"
FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disenos" DROP CONSTRAINT "disenos_id_disenador_fkey";
ALTER TABLE "disenos"
ADD CONSTRAINT "disenos_id_disenador_fkey"
FOREIGN KEY ("id_disenador") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Compras de un pedido se eliminan con el pedido, pero el comprador queda como trazabilidad nullable.
ALTER TABLE "compras" DROP CONSTRAINT "compras_id_pedido_fkey";
ALTER TABLE "compras"
ADD CONSTRAINT "compras_id_pedido_fkey"
FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compras" DROP CONSTRAINT "compras_comprado_por_id_fkey";
ALTER TABLE "compras" ALTER COLUMN "comprado_por_id" DROP NOT NULL;
ALTER TABLE "compras"
ADD CONSTRAINT "compras_comprado_por_id_fkey"
FOREIGN KEY ("comprado_por_id") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;
