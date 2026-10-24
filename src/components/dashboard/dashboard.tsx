"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { Badge, Button, Segmented, Sheet, fadeUp } from "@/components/ui/primitives";
import { deactivationRate, predict, PARAMS_F441Y, type Conditions } from "@/lib/kinetics";
import { MODEL_VERSION } from "@/lib/csv-predict";
import { cn, fmt } from "@/lib/utils";
import { PRESETS } from "./simulator-controls";
import { MetricList } from "./metric-cards";
import { DeactivationChart, ReactorContentChart, YieldCurveChart } from "./charts";
import { DEFAULT_ECON, OpportunityCost, type Economics } from "./opportunity-cost";
import { OperatingWindow } from "./operating-window";
import { CsvWorkspace } from "./csv-workspace";
import { CredibilityStrip, ProvenanceContent } from "./credibility";
import { Protocol } from "./protocol";
import { Recommendations } from "./recommendations";
import { SkyPanel } from "./sky-panel";
import { Sidebar, type View } from "./sidebar";
import { FlaskScene } from "./illustrations";

type Dyn = "yield" | "reactor" | "enzyme";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
}

function PageHeader({ title, subtitle, children }: { title: React.ReactNode; subtitle: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink sm:text-[30px]">{title}</h1>
        <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export interface DashboardUser {
  email: string;
  name: string | null;
  company: string | null;
}

export function Dashboard({ user }: { user: DashboardUser }) {
  const [view, setView] = useState<View>("sim");
  const [dyn, setDyn] = useState<Dyn>("yield");
  const [cond, setCond] = useState<Conditions>(PRESETS[0].c);
  const [econ, setEcon] = useState<Economics>(DEFAULT_ECON);
  const [db, setDb] = useState<boolean | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [hello, setHello] = useState("Selamat datang");

  // Defer recompute so slider dragging stays smooth.
  const deferred = useDeferredValue(cond);
  const { trajectory, summary, horizon_h } = useMemo(() => predict(deferred), [deferred]);

  useEffect(() => {
    setHello(greeting()); // client-only, avoids server/client time mismatch
    fetch("/api/predict")
      .then((r) => r.json())
      .then((j) => setDb(Boolean(j.supabase)))
      .catch(() => setDb(false));
  }, []);

  const simulate = (c: Conditions) => {
    setCond(c);
    setView("sim");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex max-w-[1560px] gap-2 px-3 pb-24 pt-4 sm:px-4 lg:pb-4">
        <Sidebar view={view} onView={setView} onProvenance={() => setDrawer(true)} db={db} user={user} />

        <div className="min-w-0 flex-1 rounded-[32px] bg-[#f7faff] p-4 shadow-[0_30px_80px_-40px_rgb(37_99_235/0.35)] ring-1 ring-white sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            {view === "sim" && (
              <motion.div key="sim" {...fadeUp}>
              <PageHeader
                title={<>{hello}, {user.name?.split(" ")[0] ?? "tim produksi"}</>}
                subtitle={<>Begini jalannya batch pada <span className="num font-semibold text-body">{fmt(cond.lactose_g_L, 0)} g/L · {fmt(cond.temperature_C, 1)} °C · pH {fmt(cond.pH, 2)} · {fmt(cond.enzyme_U_mL, 1)} U/mL</span>.</>}
              >
                <div className="flex items-center gap-2">
                  <Badge tone="muted" className="num hidden sm:inline-flex">{MODEL_VERSION}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => setDrawer(true)}>
                    <BookOpenCheck /> Cara kerja model
                  </Button>
                </div>
              </PageHeader>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex min-w-0 flex-col gap-5">
                  {/* Row 1: dynamics chart + metrics list */}
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <section className="panel p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-[15px] font-bold text-ink">
                            {dyn === "yield" ? "Rendemen GOS dari waktu ke waktu" : dyn === "reactor" ? "Isi reaktor" : "Aktivitas enzim"}
                          </h3>
                          <p className="text-xs text-muted">
                            {dyn === "yield"
                              ? "Rendemen memuncak, lalu enzim mulai mengurai GOS kembali."
                              : dyn === "reactor"
                                ? "Konsentrasi gula di tangki, g/L."
                                : "Deaktivasi termal enzim selama batch."}
                          </p>
                        </div>
                        <Segmented
                          id="dyn"
                          size="sm"
                          value={dyn}
                          onChange={setDyn}
                          options={[
                            { value: "yield", label: "Rendemen" },
                            { value: "reactor", label: "Isi" },
                            { value: "enzyme", label: "Enzim" },
                          ]}
                        />
                      </div>
                      <div className="mt-4">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div key={dyn} {...fadeUp}>
                            {dyn === "yield" && <YieldCurveChart traj={trajectory} s={summary} horizon={horizon_h} />}
                            {dyn === "reactor" && <ReactorContentChart traj={trajectory} s={summary} horizon={horizon_h} />}
                            {dyn === "enzyme" && <DeactivationChart traj={trajectory} s={summary} horizon={horizon_h} kd={deactivationRate(deferred.temperature_C, PARAMS_F441Y)} />}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </section>
                    <MetricList s={summary} volumeL={econ.volume_L} />
                  </div>

                  {/* Row 2: recommendations + promo */}
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
                    <Recommendations current={cond} onLoad={setCond} />
                    <section className="sky relative flex min-h-[260px] flex-col justify-end overflow-hidden rounded-[22px] p-3 shadow-[var(--shadow-card)]">
                      <FlaskScene className="absolute inset-x-0 top-0 w-full" />
                      <div className="relative rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-float)]">
                        <div className="text-[14px] font-bold text-ink">Rencanakan batch</div>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted">Unggah rencana batch dalam CSV, lalu dapatkan waktu panen tiap batch.</p>
                        <Button size="icon-sm" variant="primary" className="absolute -top-4 right-3" aria-label="Buka analisis CSV" onClick={() => setView("csv")}>
                          <ArrowRight />
                        </Button>
                      </div>
                    </section>
                  </div>

                  <OpportunityCost s={summary} econ={econ} onEcon={setEcon} />
                  <OperatingWindow c={cond} onPick={setCond} />
                  <CredibilityStrip onOpen={() => setDrawer(true)} />
                </div>

                <div className={cn("order-first xl:order-none")}>
                  <SkyPanel value={cond} onChange={setCond} />
                </div>
              </div>
              </motion.div>
            )}

            {view === "protocol" && (
              <motion.div key="protocol" {...fadeUp}>
                <PageHeader
                  title="Protokol penelitian"
                  subtitle="Alur kerja dari desain gen sampai produk GOS siap rilis. Bagian B adalah yang disimulasikan dashboard ini."
                />
                <Protocol />
              </motion.div>
            )}

            {view === "csv" && (
              <motion.div key="csv" {...fadeUp}>
                <PageHeader title="Analisis CSV" subtitle="Unggah batch rencana atau batch lampau. Tiap baris dihitung dengan model kinetika F441Y, dicocokkan dengan data referensi di server, lalu disimpan ke riwayat akun Anda." />
                <CsvWorkspace onSimulate={simulate} />
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
            <span>GenoHack 2026 · Platform biomanufaktur GOS · SoluSEA Venture Lab</span>
            <span>Keluaran model untuk mengarahkan percobaan, bukan hasil pengukuran.</span>
          </footer>
        </div>

        <Sheet open={drawer} onOpenChange={setDrawer} title="Asal-usul model" description="Mekanisme, validasi, dan asal setiap parameter.">
          <ProvenanceContent />
        </Sheet>
      </div>
    </MotionConfig>
  );
}
