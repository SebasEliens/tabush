import * as duckdb from "@duckdb/duckdb-wasm";
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import { config } from "../config";

// DuckDB-WASM runs the queries in the browser, straight on the published Parquet files,
// which it reads with HTTP range requests. No database server is involved.

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  ms: number;
}

export interface Database {
  query(sql: string): Promise<QueryResult>;
  tables: string[];
  spatial: boolean;
}

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

export function openDataUrl(file: string): string {
  return new URL(`${config.openDataUrl.replace(/\/$/, "")}/${file}`, window.location.href).toString();
}

let opening: Promise<Database> | undefined;

/** Open DuckDB once and expose each published table as a view of its Parquet file. */
export function openDatabase(tables: string[]): Promise<Database> {
  opening ??= open(tables).catch((e) => {
    opening = undefined;
    throw e;
  });
  return opening;
}

async function open(tables: string[]): Promise<Database> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conn = await db.connect();

  // The spatial extension turns the GeoParquet geometry into GEOMETRY values (ST_Area,
  // ST_Intersects...). It is downloaded from DuckDB's extension repository; without it the
  // geometry stays WKB bytes and every non-spatial question still works.
  let spatial = false;
  try {
    await conn.query("INSTALL spatial; LOAD spatial;");
    spatial = true;
  } catch {
    spatial = false;
  }
  for (const t of tables) {
    const url = openDataUrl(`${t}.parquet`);
    const cols = (await conn.query(`DESCRIBE SELECT * FROM read_parquet('${url}')`)).toArray().map((r) => r.toJSON());
    // Older readers see Parquet's GEOMETRY type as WKB bytes; decode them when we can.
    const wkb = cols.some((c) => c.column_name === "geometry" && c.column_type === "BLOB");
    const select = wkb && spatial ? "* REPLACE (ST_GeomFromWKB(geometry) AS geometry)" : "*";
    await conn.query(`CREATE OR REPLACE VIEW ${t} AS SELECT ${select} FROM read_parquet('${url}')`);
  }

  return {
    tables,
    spatial,
    async query(sql: string): Promise<QueryResult> {
      await assertReadOnly(conn, sql);
      const t0 = performance.now();
      const table = await conn.query(sql);
      const columns = table.schema.fields.map((f) => f.name);
      const rows = table.toArray().map((r) => toPlain(r.toJSON()));
      return { columns, rows, rowCount: rows.length, ms: Math.round(performance.now() - t0) };
    },
  };
}

/** Only single read-only SELECT statements may run. DuckDB's own parser decides: it can
 *  serialise a SELECT and nothing else, so COPY, ATTACH, INSTALL, SET... are refused. */
async function assertReadOnly(conn: duckdb.AsyncDuckDBConnection, sql: string) {
  const res = await conn.query(`SELECT json_serialize_sql(${quote(sql)}) AS j`);
  const parsed = JSON.parse(String(res.toArray()[0].toJSON().j));
  if (parsed.error) throw new Error(`Only a single SELECT query can run here (${parsed.error_message ?? "not a SELECT"}).`);
  if (parsed.statements?.length !== 1) throw new Error("Run one SELECT query at a time.");
}

const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;

function toPlain(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "bigint") out[k] = Number(v);
    else if (v instanceof Uint8Array) out[k] = `‹${v.byteLength} bytes›`;
    else if (v && typeof v === "object" && "toJSON" in v && typeof v.toJSON === "function") out[k] = v.toJSON();
    else if (v && typeof v === "object" && "toArray" in v && typeof v.toArray === "function") out[k] = Array.from(v.toArray() as ArrayLike<unknown>);
    else out[k] = v;
  }
  return out;
}
