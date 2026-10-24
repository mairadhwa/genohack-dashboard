"use client";

import { Flame, Gauge } from "lucide-react";
import type { Conditions } from "@/lib/kinetics";
import { GosAvatar, HillsBand, ReactorLandscape } from "./illustrations";
import { SimulatorControls } from "./simulator-controls";

/**
 * Sky panel: enzyme "profile", key facts, reactor controls, and an
 * illustrated landscape.
 *  - xl and up: tall right-hand column, sticky, landscape anchored to the bottom.
 *  - md to xl:  sits under the greeting, profile and controls side by side.
 *  - phones:    stacked.
 */
export function SkyPanel({ value, onChange }: { value: Conditions; onChange: (c: Conditions) => void }) {
  return (
    <aside className="sky relative flex flex-col overflow-hidden rounded-[28px] xl:sticky xl:top-4 xl:h-[calc(100vh-32px)]">
      <div className="relative z-10 grid flex-1 gap-4 overflow-y-auto p-5 pb-0 md:grid-cols-2 xl:flex xl:flex-col">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-ink">Profil enzim</h2>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur">EC 3.2.1.23</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-white/60 p-1.5 shadow-[0_10px_30px_-10px_rgb(27_37_65/0.35)]">
              <GosAvatar className="size-24" />
            </div>
            <div className="mt-3 text-lg font-extrabold text-ink">LacS F441Y</div>
            <div className="text-[13px] font-medium text-[#24406b]">β-galaktosidase · S. solfataricus</div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-surface p-3 shadow-[var(--shadow-float)]">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft"><Gauge className="size-4 text-primary" aria-hidden /></span>
              <div>
                <div className="text-[11px] text-muted">Rendemen terbaik</div>
                <div className="num text-[13px] font-bold text-ink">63,0% b/b</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff1dc]"><Flame className="size-4 text-warn" aria-hidden /></span>
              <div>
                <div className="text-[11px] text-muted">Tahan panas</div>
                <div className="num text-[13px] font-bold text-ink">72 jam di 80 °C</div>
              </div>
            </div>
          </div>
        </div>

        <SimulatorControls value={value} onChange={onChange} />
      </div>

      <ReactorLandscape className="relative -mt-6 hidden w-full shrink-0 xl:block" />
      <HillsBand className="mt-2 h-14 w-full shrink-0 xl:hidden" />
    </aside>
  );
}
