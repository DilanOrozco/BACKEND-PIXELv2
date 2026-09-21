import "dotenv/config";
import { performance } from "node:perf_hooks";
import { Buffer } from "node:buffer";

process.env.PERF_QUERY_LOG = "1";

type QueryEvent = {
  duration: number;
  query: string;
};

type Sample = {
  elapsedMs: number;
  prismaQueries: number;
  prismaDurationMs: number;
  responseBytes: number;
  records: number | null;
  status: number;
  queries?: string[];
};

type EndpointResult = {
  endpoint: string;
  parameters: Record<string, string | number>;
  first: Sample;
  warm: {
    runs: number;
    averageMs: number;
    minMs: number;
    maxMs: number;
    averageQueries: number;
    averagePrismaDurationMs: number;
    averageResponseBytes: number;
    records: number | null;
  };
};

const round = (value: number) => Math.round(value * 100) / 100;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const countRecords = (payload: unknown): number | null => {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== "object") return null;

  const object = payload as Record<string, unknown>;
  if (Array.isArray(object.data)) return object.data.length;

  if (object.data && typeof object.data === "object") {
    const nested = object.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data.length;
    if (Array.isArray(nested.items)) return nested.items.length;
  }

  return null;
};

const main = async () => {
  const [{ prisma }, { generarToken }, { default: app }] = await Promise.all([
    import("../src/config/prisma"),
    import("../src/utils/jwt.util"),
    import("../src/interface/server"),
  ]);

  let queryCount = 0;
  let queryDurationMs = 0;
  let queryStatements: string[] = [];
  const traceQueries = process.argv.includes("--trace");
  (prisma as any).$on("query", (event: QueryEvent) => {
    queryCount += 1;
    queryDurationMs += event.duration;
    if (traceQueries) {
      queryStatements.push(event.query.replace(/\s+/g, " ").trim().slice(0, 180));
    }
  });

  const admin = await prisma.usuario.findFirst({
    where: {
      estado: true,
      rol: { nombre: "Admin", estado: true },
    },
    select: {
      idUsuario: true,
      idRol: true,
      correo: true,
      rol: { select: { nombre: true } },
    },
  });

  if (!admin) {
    throw new Error("No hay un usuario Admin activo para ejecutar el benchmark.");
  }

  const pedido = await prisma.pedido.findFirst({
    orderBy: { idPedido: "desc" },
    select: { idPedido: true },
  });

  const token = generarToken({
    idUsuario: admin.idUsuario,
    correo: admin.correo,
    idRol: admin.idRol,
    rol: admin.rol.nombre,
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No fue posible obtener el puerto local del benchmark.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const endpointCandidates = [
    "/api/dashboard/admin",
    "/api/dashboard/admin/tendencias",
    "/api/usuarios?page=1&limit=20",
    "/api/clientes?page=1&limit=20",
    "/api/cotizaciones?page=1&limit=20",
    "/api/pedidos?page=1&limit=20",
    "/api/ventas",
    "/api/disenos?page=1&limit=20",
    "/api/disenos/produccion/pendientes",
    "/api/disenos/pedidos-pendientes",
    "/api/productos?page=1&limit=20",
    "/api/tecnicas?page=1&limit=20",
    "/api/proveedores?page=1&limit=20",
    "/api/compras",
    "/api/roles?page=1&limit=20",
    "/api/permisos",
    ...(pedido ? [`/api/pedidos/${pedido.idPedido}/expediente`] : []),
  ];
  const onlyArgument = process.argv.find((argument) => argument.startsWith("--only="));
  const onlyTerms = onlyArgument
    ? onlyArgument.slice("--only=".length).split(",").filter(Boolean)
    : [];
  const endpoints = onlyTerms.length === 0
    ? endpointCandidates
    : endpointCandidates.filter((endpoint) =>
        onlyTerms.some((term) => endpoint.includes(term)),
      );

  const run = async (endpoint: string): Promise<Sample> => {
    queryCount = 0;
    queryDurationMs = 0;
    queryStatements = [];
    const started = performance.now();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.text();
    const elapsedMs = performance.now() - started;
    let payload: unknown = null;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }

    return {
      elapsedMs: round(elapsedMs),
      prismaQueries: queryCount,
      prismaDurationMs: round(queryDurationMs),
      responseBytes: Buffer.byteLength(body),
      records: countRecords(payload),
      status: response.status,
      ...(traceQueries ? { queries: [...queryStatements] } : {}),
    };
  };

  const results: EndpointResult[] = [];
  try {
    for (const endpoint of endpoints) {
      const samples: Sample[] = [];
      for (let runIndex = 0; runIndex < 5; runIndex += 1) {
        samples.push(await run(endpoint));
      }

      const [first, ...warm] = samples;
      const url = new URL(endpoint, baseUrl);
      results.push({
        endpoint: url.pathname,
        parameters: Object.fromEntries(url.searchParams.entries()),
        first,
        warm: {
          runs: warm.length,
          averageMs: round(average(warm.map((sample) => sample.elapsedMs))),
          minMs: Math.min(...warm.map((sample) => sample.elapsedMs)),
          maxMs: Math.max(...warm.map((sample) => sample.elapsedMs)),
          averageQueries: round(
            average(warm.map((sample) => sample.prismaQueries)),
          ),
          averagePrismaDurationMs: round(
            average(warm.map((sample) => sample.prismaDurationMs)),
          ),
          averageResponseBytes: round(
            average(warm.map((sample) => sample.responseBytes)),
          ),
          records: warm.at(-1)?.records ?? null,
        },
      });
    }

    console.log(JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
