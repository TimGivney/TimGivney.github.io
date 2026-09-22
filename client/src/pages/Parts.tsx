import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Database, Search } from "lucide-react";

type Price = {
  label: string;
  value: number;
  currency: string;
  date: string | null;
};

type Rec = {
  oem: string;
  part: string;
  key: string;
  desc: string | null;
  qty: string | null;
  assembly: string | null;
  pump: string | null;
  common: string | null;
  location: string | null;
  prices: Price[];
  src: string;
  row: number;
  commonPumps: string[];
};

type Source = { file: string; sheet: string; oem: string; records: number };
type Dataset = { sources: Source[]; records: Rec[] };

type View =
  | { kind: "search" }
  | { kind: "part"; key: string }
  | { kind: "pump"; pump: string }
  | { kind: "oem"; oem: string }
  | { kind: "data" };

const NOT_SPECIFIED = "Not specified in imported source.";

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function money(p: Price) {
  const v = p.value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${p.currency} ${v}`;
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-zinc-800 pt-4">
      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 hover:border-amber-400 hover:text-amber-300"
    >
      {children}
    </button>
  );
}

export default function Parts() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>({ kind: "search" });
  const [oemFilter, setOemFilter] = useState<string>("");

  useEffect(() => {
    fetch("/parts/parts.json")
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: Dataset) => setData(d))
      .catch(e => setError(String(e)));
  }, []);

  const records = data?.records ?? [];

  const index = useMemo(() => {
    const byKey = new Map<string, Rec[]>();
    const byPump = new Map<string, Rec[]>();
    const byOem = new Map<string, Rec[]>();
    for (const r of records) {
      byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);
      if (r.pump) byPump.set(r.pump, [...(byPump.get(r.pump) ?? []), r]);
      byOem.set(r.oem, [...(byOem.get(r.oem) ?? []), r]);
    }
    return { byKey, byPump, byOem };
  }, [records]);

  const results = useMemo(() => {
    const raw = q.trim();
    if (raw.length < 2) return null;
    const nk = normKey(raw);
    const words = raw.toLowerCase().split(/\s+/).filter(Boolean);

    const partHits = new Map<string, Rec[]>();
    for (const r of records) {
      if (oemFilter && r.oem !== oemFilter) continue;
      const hay = `${r.part} ${r.desc ?? ""} ${r.assembly ?? ""}`.toLowerCase();
      const hit =
        (nk && r.key.includes(nk)) || words.every(w => hay.includes(w));
      if (hit) partHits.set(r.key, [...(partHits.get(r.key) ?? []), r]);
    }
    const pumps = Array.from(index.byPump.keys()).filter(p =>
      normKey(p).includes(nk)
    );
    const commonPumps = uniq(
      records.flatMap(r => r.commonPumps).filter(p => normKey(p) === nk)
    );
    const oems = Array.from(index.byOem.keys()).filter(o =>
      o.toLowerCase().includes(raw.toLowerCase())
    );
    // exact part-number hits first
    const parts = Array.from(partHits.values()).sort((a, b) => {
      const ea = a[0].key === nk ? 0 : 1;
      const eb = b[0].key === nk ? 0 : 1;
      return ea - eb || a[0].part.localeCompare(b[0].part);
    });
    return { parts, pumps: uniq([...pumps, ...commonPumps]), oems };
  }, [q, records, index, oemFilter]);

  const oemList = useMemo(() => Array.from(index.byOem.keys()).sort(), [index]);

  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0c11] text-zinc-100">
      <header className="border-b border-zinc-800 bg-[#0d1017]">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-1 font-mono text-xs text-zinc-400 hover:text-amber-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <button
            type="button"
            onClick={() => go({ kind: "search" })}
            className="font-mono text-sm font-semibold tracking-[0.25em] text-amber-400"
          >
            PARTSBENDER PARTS FINDER
          </button>
          <nav className="ml-auto flex gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => go({ kind: "search" })}
              className={
                view.kind === "data" ? "text-zinc-400" : "text-amber-300"
              }
            >
              SEARCH
            </button>
            <button
              type="button"
              onClick={() => go({ kind: "data" })}
              className={
                view.kind === "data" ? "text-amber-300" : "text-zinc-400"
              }
            >
              DATA
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {view.kind !== "data" && (
          <div className="mb-6">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 focus-within:border-amber-400">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                autoFocus
                value={q}
                onChange={e => {
                  setQ(e.target.value);
                  if (view.kind !== "search") setView({ kind: "search" });
                }}
                placeholder="Search part number, pump, OEM or description…"
                className="w-full bg-transparent font-mono text-base outline-none placeholder:text-zinc-600"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[11px] text-zinc-500">
              <span className="mr-1">OEM:</span>
              <button
                type="button"
                onClick={() => setOemFilter("")}
                className={oemFilter === "" ? "text-amber-300" : ""}
              >
                All
              </button>
              {oemList.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOemFilter(o)}
                  className={oemFilter === o ? "text-amber-300" : ""}
                >
                  · {o}
                </button>
              ))}
              {data && (
                <span className="ml-auto">
                  {records.length.toLocaleString()} rows ·{" "}
                  {index.byKey.size.toLocaleString()} parts ·{" "}
                  {index.byPump.size} pumps
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="font-mono text-sm text-red-400">
            Could not load data: {error}
          </p>
        )}
        {!data && !error && (
          <p className="font-mono text-sm text-zinc-500">Loading parts data…</p>
        )}

        {data && view.kind === "search" && !results && (
          <div className="font-mono text-sm text-zinc-500">
            <p>Try:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                "50818625",
                "3911650100SP",
                "BA200E D328",
                "12 0282 3065",
                "mechanical seal",
                "Pioneer",
              ].map(s => (
                <Chip key={s} onClick={() => setQ(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {data && view.kind === "search" && results && (
          <div className="space-y-6">
            {results.oems.length > 0 && (
              <Section title="OEMs">
                <div className="flex flex-wrap gap-2">
                  {results.oems.map(o => (
                    <Chip key={o} onClick={() => go({ kind: "oem", oem: o })}>
                      {o} · {index.byOem.get(o)?.length} rows
                    </Chip>
                  ))}
                </div>
              </Section>
            )}
            {results.pumps.length > 0 && (
              <Section title="Pumps">
                <div className="flex flex-wrap gap-2">
                  {results.pumps.slice(0, 40).map(p => (
                    <Chip key={p} onClick={() => go({ kind: "pump", pump: p })}>
                      {p}
                    </Chip>
                  ))}
                </div>
              </Section>
            )}
            <Section title={`Parts · ${results.parts.length}`}>
              {results.parts.length === 0 && (
                <p className="font-mono text-sm text-zinc-500">
                  No parts match.
                </p>
              )}
              <ul className="divide-y divide-zinc-800">
                {results.parts.slice(0, 200).map(rs => {
                  const r = rs[0];
                  return (
                    <li key={r.key}>
                      <button
                        type="button"
                        onClick={() => go({ kind: "part", key: r.key })}
                        className="flex w-full flex-wrap items-baseline gap-x-4 py-2 text-left hover:bg-zinc-900"
                      >
                        <span className="font-mono text-sm text-amber-300">
                          {r.part}
                        </span>
                        <span className="text-sm text-zinc-200">
                          {r.desc ?? "—"}
                        </span>
                        <span className="ml-auto font-mono text-xs text-zinc-500">
                          {uniq(rs.map(x => x.oem)).join(", ")} ·{" "}
                          {uniq(rs.map(x => x.pump).filter(Boolean)).length}{" "}
                          pump(s)
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {results.parts.length > 200 && (
                <p className="mt-2 font-mono text-xs text-zinc-500">
                  Showing first 200 — refine your search.
                </p>
              )}
            </Section>
          </div>
        )}

        {data && view.kind === "part" && (
          <PartView
            rows={index.byKey.get(view.key) ?? []}
            index={index}
            go={go}
          />
        )}
        {data && view.kind === "pump" && (
          <PumpView pump={view.pump} records={records} go={go} />
        )}
        {data && view.kind === "oem" && (
          <OemView
            rows={index.byOem.get(view.oem) ?? []}
            oem={view.oem}
            go={go}
          />
        )}
        {data && view.kind === "data" && <DataView data={data} />}
      </main>
    </div>
  );
}

function PartView({
  rows,
  index,
  go,
}: {
  rows: Rec[];
  index: { byPump: Map<string, Rec[]> };
  go: (v: View) => void;
}) {
  if (rows.length === 0)
    return <p className="font-mono text-sm text-zinc-500">Part not found.</p>;
  const r = rows[0];
  const oems = uniq(rows.map(x => x.oem));
  const variants = uniq(rows.map(x => x.part));
  const descs = uniq(rows.map(x => x.desc).filter(Boolean) as string[]);
  const pumps = uniq(rows.map(x => x.pump).filter(Boolean) as string[]);
  const assemblies = uniq(
    rows.map(x => x.assembly).filter(Boolean) as string[]
  );
  const common = uniq(rows.flatMap(x => x.commonPumps));
  const commonRaw = uniq(rows.map(x => x.common).filter(Boolean) as string[]);
  const prices = uniq(
    rows.flatMap(x => x.prices.map(p => JSON.stringify({ ...p, src: x.src })))
  ).map(s => JSON.parse(s) as Price & { src: string });
  const related = new Map<string, Rec>();
  for (const p of pumps)
    for (const x of index.byPump.get(p) ?? [])
      if (
        x.key !== r.key &&
        !related.has(x.key) &&
        (assemblies.length === 0 || assemblies.includes(x.assembly ?? ""))
      )
        related.set(x.key, x);
  const relatedList = Array.from(related.values()).slice(0, 30);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-mono text-2xl text-amber-300">{r.part}</h2>
        <p className="text-lg text-zinc-100">
          {oems.join(" / ")} — {descs.join(" · ") || "No description"}
        </p>
        {variants.length > 1 && (
          <p className="font-mono text-xs text-zinc-500">
            Part-number variants in source: {variants.join(", ")}
          </p>
        )}
      </div>
      <Section title="Used on">
        {pumps.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Pump compatibility: {NOT_SPECIFIED}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pumps.map(p => (
              <Chip key={p} onClick={() => go({ kind: "pump", pump: p })}>
                {p}
              </Chip>
            ))}
          </div>
        )}
      </Section>
      <Section title="Assembly">
        <p className="text-sm text-zinc-200">
          {assemblies.length ? assemblies.join(", ") : NOT_SPECIFIED}
        </p>
      </Section>
      <Section title="Common with">
        {common.length === 0 ? (
          <p className="text-sm text-zinc-500">{NOT_SPECIFIED}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {common.map(p => (
                <Chip key={p} onClick={() => go({ kind: "pump", pump: p })}>
                  {p}
                </Chip>
              ))}
            </div>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">
              source value: {commonRaw.join(" | ")}
            </p>
          </>
        )}
      </Section>
      <Section title="Pricing found">
        {prices.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No pricing in imported source.
          </p>
        ) : (
          <table className="w-full font-mono text-sm">
            <thead className="text-left text-[11px] text-zinc-500">
              <tr>
                <th className="py-1">Source</th>
                <th>Price</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="py-1 text-zinc-300">{p.label}</td>
                  <td className="text-amber-300">{money(p)}</td>
                  <td className="text-zinc-400">{p.date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      {relatedList.length > 0 && (
        <Section title="Related parts (same pump & assembly)">
          <div className="flex flex-wrap gap-2">
            {relatedList.map(x => (
              <Chip
                key={x.key}
                onClick={() => go({ kind: "part", key: x.key })}
              >
                {x.part}
                {x.desc ? ` — ${x.desc}` : ""}
              </Chip>
            ))}
          </div>
        </Section>
      )}
      <Section title="Source data">
        <ul className="font-mono text-xs text-zinc-400">
          {rows.map((x, i) => (
            <li key={i}>
              {x.src} · row {x.row}
              {x.pump ? ` · ${x.pump}` : ""}
              {x.qty ? ` · qty ${x.qty}` : ""}
              {x.location ? ` · loc ${x.location}` : ""}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function PumpView({
  pump,
  records,
  go,
}: {
  pump: string;
  records: Rec[];
  go: (v: View) => void;
}) {
  const nk = normKey(pump);
  const direct = records.filter(r => r.pump === pump);
  const viaCommon = records.filter(
    r => r.pump !== pump && r.commonPumps.some(c => normKey(c) === nk)
  );
  const rows = direct.length ? direct : viaCommon;
  const oems = uniq(rows.map(r => r.oem));
  const parts = new Map<string, Rec>();
  for (const r of rows) if (!parts.has(r.key)) parts.set(r.key, r);
  const assemblies = new Map<string, number>();
  for (const r of rows) {
    const a = r.assembly ?? "Unspecified";
    assemblies.set(a, (assemblies.get(a) ?? 0) + 1);
  }
  const commonWith = uniq(rows.flatMap(r => r.commonPumps)).filter(
    c => normKey(c) !== nk
  );
  const [asm, setAsm] = useState<string>("");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-mono text-2xl text-amber-300">{pump}</h2>
        <p className="text-lg text-zinc-100">{oems.join(" / ") || "—"}</p>
        {!direct.length && (
          <p className="font-mono text-xs text-zinc-500">
            No rows list this pump directly; showing parts whose “Common” field
            names it.
          </p>
        )}
      </div>
      {commonWith.length > 0 && (
        <Section title="Common with">
          <div className="flex flex-wrap gap-2">
            {commonWith.map(p => (
              <Chip key={p} onClick={() => go({ kind: "pump", pump: p })}>
                {p}
              </Chip>
            ))}
          </div>
        </Section>
      )}
      <Section title="Assembly breakdown">
        <div className="flex flex-wrap gap-2">
          <Chip onClick={() => setAsm("")}>
            {asm === "" ? "▸ " : ""}All · {rows.length}
          </Chip>
          {Array.from(assemblies.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([a, n]) => (
              <Chip key={a} onClick={() => setAsm(a)}>
                {asm === a ? "▸ " : ""}
                {a} · {n}
              </Chip>
            ))}
        </div>
      </Section>
      <Section title={`Parts found · ${parts.size}`}>
        <ul className="divide-y divide-zinc-800">
          {Array.from(parts.values())
            .filter(r => !asm || (r.assembly ?? "Unspecified") === asm)
            .map(r => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => go({ kind: "part", key: r.key })}
                  className="flex w-full flex-wrap items-baseline gap-x-4 py-1.5 text-left hover:bg-zinc-900"
                >
                  <span className="font-mono text-sm text-amber-300">
                    {r.part}
                  </span>
                  <span className="text-sm text-zinc-200">{r.desc ?? "—"}</span>
                  <span className="ml-auto font-mono text-xs text-zinc-500">
                    {r.assembly ?? ""}
                    {r.qty ? ` · qty ${r.qty}` : ""}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </Section>
    </div>
  );
}

function OemView({
  oem,
  rows,
  go,
}: {
  oem: string;
  rows: Rec[];
  go: (v: View) => void;
}) {
  const pumps = uniq(rows.map(r => r.pump).filter(Boolean) as string[]).sort();
  const parts = uniq(rows.map(r => r.key)).length;
  const assemblies = uniq(
    rows.map(r => r.assembly).filter(Boolean) as string[]
  ).sort();
  const sources = uniq(rows.map(r => r.src));
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-mono text-2xl text-amber-300">
          {oem.toUpperCase()}
        </h2>
        <p className="text-lg text-zinc-100">
          {rows.length.toLocaleString()} rows · {parts.toLocaleString()}{" "}
          distinct part numbers
        </p>
      </div>
      <Section title={`Pump types · ${pumps.length}`}>
        {pumps.length === 0 ? (
          <p className="text-sm text-zinc-500">{NOT_SPECIFIED}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pumps.map(p => (
              <Chip key={p} onClick={() => go({ kind: "pump", pump: p })}>
                {p}
              </Chip>
            ))}
          </div>
        )}
      </Section>
      <Section title={`Assemblies · ${assemblies.length}`}>
        <p className="text-sm text-zinc-300">
          {assemblies.length
            ? assemblies.slice(0, 60).join(" · ")
            : NOT_SPECIFIED}
          {assemblies.length > 60 ? " …" : ""}
        </p>
      </Section>
      <Section title="Sources">
        <ul className="font-mono text-xs text-zinc-400">
          {sources.map(s => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function DataView({ data }: { data: Dataset }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-amber-400" />
        <h2 className="font-mono text-xl text-amber-300">DATA</h2>
      </div>
      <p className="text-sm text-zinc-400">
        Raw workbooks live untouched in <code>data/parts/raw/</code>. The ingest
        script (<code>scripts/parts/ingest.py</code>) maps each sheet to a
        common record shape and writes <code>parts.json</code>. Missing fields
        stay empty — nothing is invented. Upload / preview / import history is
        the next stage.
      </p>
      <Section title="Imported sheets">
        <table className="w-full font-mono text-sm">
          <thead className="text-left text-[11px] text-zinc-500">
            <tr>
              <th className="py-1">File</th>
              <th>Sheet</th>
              <th>OEM</th>
              <th className="text-right">Rows</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map(s => (
              <tr key={s.file + s.sheet} className="border-t border-zinc-800">
                <td className="py-1 text-zinc-300">{s.file}</td>
                <td className="text-zinc-300">{s.sheet}</td>
                <td className="text-zinc-300">{s.oem}</td>
                <td className="text-right text-amber-300">{s.records}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
