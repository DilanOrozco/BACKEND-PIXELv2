import "dotenv/config";
import { prisma } from "../src/config/prisma";

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Plan Rows"?: number;
  "Actual Rows"?: number;
  "Actual Total Time"?: number;
  "Rows Removed by Filter"?: number;
  "Sort Method"?: string;
  Plans?: PlanNode[];
};

const summarizePlan = (node: PlanNode): Record<string, unknown>[] => [
  {
    nodeType: node["Node Type"],
    relation: node["Relation Name"] ?? null,
    index: node["Index Name"] ?? null,
    planRows: node["Plan Rows"] ?? null,
    actualRows: node["Actual Rows"] ?? null,
    actualTotalTimeMs: node["Actual Total Time"] ?? null,
    rowsRemovedByFilter: node["Rows Removed by Filter"] ?? 0,
    sortMethod: node["Sort Method"] ?? null,
  },
  ...(node.Plans ?? []).flatMap(summarizePlan),
];

const plans = [
  {
    name: "pedidos_listado",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id_pedido"
      FROM "pedidos"
      WHERE "estadoPedido" <> 'ENTREGADO'
      ORDER BY "id_pedido" DESC
      LIMIT 10`,
  },
  {
    name: "cotizaciones_listado",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id_cotizacion"
      FROM "cotizaciones"
      WHERE "estado" <> 'CONVERTIDA_EN_PEDIDO'
      ORDER BY "id_cotizacion" DESC
      LIMIT 10`,
  },
  {
    name: "cotizaciones_versiones_vencidas",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id_cotizacion"
      FROM "cotizaciones_versiones"
      WHERE "es_vigente" = true
        AND "estado" = 'ENVIADA'
        AND "valida_hasta" <= NOW()`,
  },
  {
    name: "abonos_ingresos_anuales",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT COALESCE(SUM("monto"), 0)
      FROM "abonos"
      WHERE "estado" = 'CONFIRMADO'
        AND "fecha_confirmacion" >= date_trunc('year', NOW())
        AND "fecha_confirmacion" < date_trunc('year', NOW()) + interval '1 year'`,
  },
  {
    name: "disenos_produccion",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT diseno."id_diseno"
      FROM "disenos" AS diseno
      INNER JOIN "pedidos" AS pedido
        ON pedido."id_pedido" = diseno."id_pedido"
      WHERE diseno."estado" = 'APROBADO'
        AND pedido."estadoPedido" = 'EN_PROCESO'
      ORDER BY diseno."fecha_aprobacion" ASC
      LIMIT 20`,
  },
  {
    name: "detalles_por_pedido",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id_detalle_pedido"
      FROM "detalle_pedido"
      WHERE "id_pedido" = (SELECT MAX("id_pedido") FROM "pedidos")`,
  },
  {
    name: "disenos_por_pedido",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id_diseno"
      FROM "disenos"
      WHERE "id_pedido" = (SELECT MAX("id_pedido") FROM "pedidos")
      ORDER BY "fecha_creacion" DESC`,
  },
  {
    name: "usuarios_por_rol_estado",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id_usuario"
      FROM "usuarios"
      WHERE "id_rol" = (SELECT MIN("id_rol") FROM "roles")
        AND "estado" = true`,
  },
  {
    name: "compras_por_proveedor_fecha",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id_compra"
      FROM "compras"
      WHERE "id_proveedor" = (SELECT MIN("id_proveedor") FROM "proveedores")
      ORDER BY "fecha_compra" DESC`,
  },
];

const main = async () => {
  const counts = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      (SELECT COUNT(*) FROM "usuarios")::bigint AS "usuarios",
      (SELECT COUNT(*) FROM "clientes")::bigint AS "clientes",
      (SELECT COUNT(*) FROM "cotizaciones")::bigint AS "cotizaciones",
      (SELECT COUNT(*) FROM "detalle_cotizacion")::bigint AS "detallesCotizacion",
      (SELECT COUNT(*) FROM "pedidos")::bigint AS "pedidos",
      (SELECT COUNT(*) FROM "detalle_pedido")::bigint AS "detallesPedido",
      (SELECT COUNT(*) FROM "abonos")::bigint AS "abonos",
      (SELECT COUNT(*) FROM "ventas")::bigint AS "ventas",
      (SELECT COUNT(*) FROM "disenos")::bigint AS "disenos",
      (SELECT COUNT(*) FROM "compras")::bigint AS "compras",
      (SELECT COUNT(*) FROM "detalle_compra")::bigint AS "detallesCompra",
      (SELECT COUNT(*) FROM "productos_cotizables")::bigint AS "productos",
      (SELECT COUNT(*) FROM "tecnicas")::bigint AS "tecnicas",
      (SELECT COUNT(*) FROM "proveedores")::bigint AS "proveedores"
  `;

  const indexes = await prisma.$queryRaw<
    Array<{ tableName: string; indexName: string; definition: string }>
  >`
    SELECT
      tablename AS "tableName",
      indexname AS "indexName",
      indexdef AS "definition"
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename IN (
        'usuarios', 'clientes', 'cotizaciones', 'cotizaciones_versiones',
        'pedidos', 'detalle_pedido', 'abonos', 'ventas', 'disenos',
        'compras', 'detalle_compra', 'productos_cotizables'
      )
    ORDER BY tablename, indexname
  `;

  const explained = [];
  for (const plan of plans) {
    const rows = await prisma.$queryRawUnsafe<any[]>(plan.sql);
    const document = rows[0]?.["QUERY PLAN"]?.[0];
    explained.push({
      name: plan.name,
      planningTimeMs: document?.["Planning Time"] ?? null,
      executionTimeMs: document?.["Execution Time"] ?? null,
      nodes: document?.Plan ? summarizePlan(document.Plan) : [],
    });
  }

  console.log(
    JSON.stringify(
      {
        counts: Object.fromEntries(
          Object.entries(counts[0] ?? {}).map(([key, value]) => [
            key,
            Number(value),
          ]),
        ),
        indexes,
        plans: explained,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
