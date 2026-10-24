"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, BookOpen, CircleDot, ShieldCheck } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import sensitivity from "@/data/sensitivity.json";
import { cn, fmt } from "@/lib/utils";
import { AXIS, Legend } from "./charts";

export const VALIDATION = [
  { label: "Wu dkk. 2013", title: "Validasi independen", kind: "independent", cond: "700 g/L · 75 °C · pH 6,0 · 9 U/mL · tipe liar", predicted: 52.7, published: 50.9, error: 3.6, note: "Tidak ada parameter yang disetel ke titik ini. Satu-satunya uji di luar data kalibrasi." },
  { label: "Sun dkk. 2014", title: "Titik acuan F441Y", kind: "anchor", cond: "700 g/L · 75 °C · pH 6,0 · 9 U/mL · F441Y", predicted: 61.0, published: 61.0, error: 0, note: "Enzim, inang, dan produk sama dengan platform ini. K_acc F441Y difit di titik ini." },
  { label: "Park dkk. 2008", title: "Kalibrasi tipe liar", kind: "calibration", cond: "600 g/L · 80 °C · pH 6,0 · 3,6 U/mL · puncak jam ke-56", predicted: 52.5, published: 52.5, error: 0, note: "Melingkar: dua parameter disetel untuk mengenai dua angka." },
] as const;

const PROVENANCE = [
  { group: "Dari publikasi", tone: "ok" as const, items: [["Km laktosa", "26,3 mM", "Sun 2014"], ["kcat laktosa", "160,1 /menit", "Sun 2014"], ["Energi deaktivasi", "213 kJ/mol", "Park 2008"], ["Waktu paruh 80 °C", "72 jam", "Park 2008"], ["pH optimum reaksi", "6,0", "Sun 2014 · Park 2008"]] },
  { group: "Dikalibrasi ke publikasi", tone: "primary" as const, items: [["K_acc tipe liar", "60,5 mM", "Park 2008"], ["K_acc F441Y", "18,9 mM", "Sun 2014"], ["Dosis 9 U/mL", "0,00725 mM", "Park 2008"]] },
  { group: "Disetel tim, belum difit", tone: "warn" as const, items: [["kcat GOS", "60 /s", "tidak teridentifikasi"], ["Km GOS · Ki galaktosa", "220 · 6 mM", "asumsi"], ["Ea kat · Ea sel", "48 · 26 kJ/mol", "asumsi"], ["Lebar kurva pH", "1,1 · 1,4", "asumsi"]] },
];

const LIMITS = [
  "Optimum 63,0% (800 g/L, 85 °C) berada di tepi grid, jadi termasuk ekstrapolasi.",
  "GOS dihitung sebagai satu spesies; sebaran derajat polimerisasi belum dimodelkan.",
  "Galaktosa hanya berperan sebagai inhibitor, belum sebagai akseptor alternatif.",
  "Substrat laktosa murni, bukan whey. Reaktor batch ideal, enzim bebas, suhu dan pH tetap.",
  "Angka rendemen terbitan diambil dari abstrak; definisi rendemennya belum dicek ke naskah lengkap.",
  "Kelarutan laktosa memakai korelasi kasar sementara.",
];

function H({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h4 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
      <span className="num flex size-5 items-center justify-center rounded border border-line-strong text-[11px] text-primary">{n}</span>
      {children}
    </h4>
  );
}

/** Compact summary shown in the main workspace; opens the full drawer. */
export function CredibilityStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="panel grid gap-px overflow-hidden bg-line! md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      {VALIDATION.map((v) => (
        <div key={v.label} className="bg-surface px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {v.kind === "independent" ? <ShieldCheck className="size-3 text-ok" /> : <CircleDot className="size-3 text-primary" />}
            {v.title}
          </div>
          <div className="num mt-1 text-[13px] text-body">
            <span className="text-lg font-semibold text-ink">{fmt(v.predicted, 1)}%</span>
            <span className="text-muted"> model vs </span>
            {fmt(v.published, 1)}% <span className="text-muted">{v.label}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center bg-surface px-4 py-3">
        <Button size="sm" onClick={onOpen}>
          Asal-usul model <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

/** Full provenance content rendered inside the right-hand drawer. */
export function ProvenanceContent() {
  const drops = sensitivity.map((s) => s.drop_pct);
  return (
    <div className="space-y-8">
      <section>
        <H n="1">Cara kerja model</H>
        <p className="text-[13px] leading-relaxed text-muted">
          Model ODE 5 spesies (laktosa, glukosa, galaktosa, GOS, enzim aktif) untuk mekanisme galaktosil-enzim. Enzim mengambil gugus galaktosil
          dari <span className="text-body">donor</span>, lalu memindahkannya ke <span className="text-body">akseptor</span>:
        </p>
        <div className="num mt-3 space-y-1 rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-body">
          <div>E + Laktosa → E·Gal + Glukosa <span className="text-muted">· donor 1</span></div>
          <div>E + GOS → E·Gal + Laktosa <span className="text-bad">· donor 2, GOS terurai</span></div>
          <div>E·Gal + H₂O → E + Galaktosa <span className="text-warn">· hidrolisis (rugi)</span></div>
          <div>E·Gal + Laktosa → E + GOS <span className="text-primary">· transgalaktosilasi (untung)</span></div>
          <div className="pt-1 text-muted">p_trans = [Lac] / (K_acc,eff + [Lac]) · galaktosa menghambat secara kompetitif · dE/dt = −k_d(T)·E</div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          GOS adalah produk antara. Begitu laktosa menipis, enzim mulai memakai GOS sebagai donor, sehingga rendemen memuncak lalu turun. Karena itu
          waktu panen penting. Browser menghitung model ini dengan RK4, dan hasilnya cocok dengan keluaran SciPy tim dalam selisih 0,03 poin rendemen.
        </p>
      </section>

      <section>
        <H n="2">Validasi</H>
        <div className="space-y-2">
          {VALIDATION.map((v) => (
            <div key={v.label} className={cn("rounded-lg border p-3", v.kind === "independent" ? "border-ok/30 bg-ok/[0.04]" : "border-line bg-subtle")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">{v.title}</span>
                  {v.kind === "independent" ? <Badge tone="ok"><ShieldCheck className="size-3" /> di luar sampel</Badge> : v.kind === "anchor" ? <Badge tone="primary">acuan</Badge> : <Badge tone="muted">kalibrasi</Badge>}
                </div>
                <span className="num text-[13px]">
                  <span className="font-semibold text-primary">{fmt(v.predicted, 1)}%</span>
                  <span className="text-muted"> vs </span>
                  <span className="font-semibold text-ink">{fmt(v.published, 1)}%</span>
                  <span className={cn("ml-2", v.error > 0 ? "text-warn" : "text-ok")}>Δ {fmt(v.error, 1)}%</span>
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">{v.label} · {v.cond}</div>
              <div className="mt-1 text-xs text-body">{v.note}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 h-[180px]" role="img" aria-label="Rendemen model dibandingkan terbitan">
          <ResponsiveContainer>
            <BarChart data={VALIDATION.map((v) => ({ name: v.label, Model: v.predicted, Terbitan: v.published }))} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={3}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis domain={[40, 65]} ticks={[40, 45, 50, 55, 60, 65]} tickFormatter={(v) => `${v}%`} tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => `${fmt(v, 1)}%`} cursor={{ fill: "rgb(37 99 235 / 0.05)" }} contentStyle={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e3ebf6", fontSize: 12 }} itemStyle={{ color: "#1b2541" }} />
              <Bar dataKey="Model" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Terbitan" fill="#1b2541" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legend items={[{ label: "Model", color: "#2563eb" }, { label: "Terbitan", color: "#1b2541" }]} />
      </section>

      <section>
        <H n="3">Asal setiap parameter</H>
        <div className="grid gap-4 sm:grid-cols-3">
          {PROVENANCE.map((g) => (
            <div key={g.group}>
              <Badge tone={g.tone}>{g.group}</Badge>
              <ul className="mt-2 space-y-2">
                {g.items.map(([k, v, s]) => (
                  <li key={k} className="text-xs">
                    <div className="flex justify-between gap-2"><span className="text-body">{k}</span><span className="num font-medium text-ink">{v}</span></div>
                    <div className="text-muted">{s}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <H n="4">Mengapa F441Y menghasilkan lebih banyak</H>
        <p className="text-[13px] leading-relaxed text-muted">
          Melemahnya inhibisi galaktosa hanya mempercepat waktu puncak, tidak menaikkan puncaknya. Kenaikan 50,9% → 61,7% dijelaskan oleh kantong
          akseptor yang lebih baik (K_acc turun). Arahnya kokoh; besarnya bergantung pada kcat_gos, yang belum bisa ditentukan dari data yang ada.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <table className="w-full text-xs">
            <thead className="bg-subtle text-[11px] uppercase tracking-[0.06em] text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">kcat_gos /s</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">K_acc WT → F441Y</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Turun</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">vs Wu</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Panen</th>
              </tr>
            </thead>
            <tbody>
              {sensitivity.map((s) => (
                <tr key={s.kcat_gos} className="num border-t border-line transition-colors hover:bg-subtle">
                  <td className="px-3 py-1.5">{fmt(s.kcat_gos, s.kcat_gos % 1 ? 2 : 0)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(s.K_acc_WT, 1)} → {fmt(s.K_acc_F441Y, 1)} mM</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-primary">{fmt(s.drop_pct, 0)}%</td>
                  <td className="px-3 py-1.5 text-right">{fmt(s.error_vs_wu_pct, 1)}%</td>
                  <td className="px-3 py-1.5 text-right">{fmt(s.harvest_F441Y_h, 1)} jam</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Uji silang lolos di semua nilai, jadi penurunan K_acc disebut sebagai rentang:{" "}
          <span className="num font-semibold text-ink">{fmt(Math.min(...drops), 0)}–{fmt(Math.max(...drops), 0)}%</span>.
        </p>
      </section>

      <section className="rounded-lg border border-warn/30 bg-warn/[0.05] p-4">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-warn"><AlertTriangle className="size-4" /> Baca sebelum mengambil keputusan</h4>
        <p className="mt-1 text-xs text-muted">Angka rendemen di sini untuk menentukan arah dan prioritas percobaan, bukan hasil pengukuran.</p>
        <ul className="mt-3 space-y-1.5 text-[13px] text-body">
          {LIMITS.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-warn" aria-hidden />{t}</li>)}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><BookOpen className="size-3.5" /> gos/README.md · docs/perubahan_base.md · hasil/ringkasan_F441Y.txt</p>
      </section>
    </div>
  );
}
