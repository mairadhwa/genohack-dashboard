"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Droplets, FlaskConical, RotateCcw, Thermometer, Zap } from "lucide-react";
import { Button, Slider, fadeUp } from "@/components/ui/primitives";
import type { Conditions } from "@/lib/kinetics";
import { flagsFor, lactoseSolubility } from "@/lib/kinetics";
import { cn, fmt } from "@/lib/utils";

export const PRESETS: { id: string; label: string; hint: string; c: Conditions }[] = [
  { id: "opt", label: "Optimum model", hint: "800 g/L · 85 °C · pH 6,0", c: { lactose_g_L: 800, temperature_C: 85, pH: 6.0, enzyme_U_mL: 9 } },
  { id: "sun", label: "Acuan Sun 2014", hint: "700 g/L · 75 °C · pH 6,0", c: { lactose_g_L: 700, temperature_C: 75, pH: 6.0, enzyme_U_mL: 9 } },
  { id: "floor", label: "Batas bawah jendela", hint: "500 g/L · 70 °C · pH 6,0", c: { lactose_g_L: 500, temperature_C: 70, pH: 6.0, enzyme_U_mL: 9 } },
];

const FIELDS: { key: keyof Conditions; label: string; unit: string; min: number; max: number; step: number; digits: number; icon: typeof Thermometer }[] = [
  { key: "temperature_C", label: "Suhu", unit: "°C", min: 70, max: 85, step: 0.5, digits: 1, icon: Thermometer },
  { key: "pH", label: "pH", unit: "", min: 5.0, max: 6.5, step: 0.05, digits: 2, icon: Droplets },
  { key: "lactose_g_L", label: "Laktosa awal", unit: "g/L", min: 500, max: 800, step: 10, digits: 0, icon: FlaskConical },
  { key: "enzyme_U_mL", label: "Dosis enzim", unit: "U/mL", min: 1, max: 15, step: 0.5, digits: 1, icon: Zap },
];

const FLAG_TEXT: Record<string, (sol: number) => string> = {
  above_solubility: (sol) => `Laktosa melebihi perkiraan kelarutan (${fmt(sol, 0)} g/L di suhu ini)`,
  outside_operating_window: () => "Di luar jendela operasi ≥95%",
  extrapolation: () => "Di luar batas pencarian grid — ekstrapolasi",
};

export function SimulatorControls({ value, onChange }: { value: Conditions; onChange: (c: Conditions) => void }) {
  const flags = flagsFor(value);
  const sol = lactoseSolubility(value.temperature_C);

  return (
    <div className="rounded-[20px] bg-surface p-4 shadow-[var(--shadow-float)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-ink">Kondisi reaktor</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Kembalikan ke optimum model" onClick={() => onChange(PRESETS[0].c)}>
          <RotateCcw />
        </Button>
      </div>

      <div className="mt-3 space-y-4">
        {FIELDS.map((f) => {
          const v = value[f.key];
          const outOfSlider = v < f.min || v > f.max;
          return (
            <div key={f.key}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label htmlFor={`in-${f.key}`} className="flex items-center gap-2 text-[13px] font-medium text-body">
                  <f.icon className="size-3.5 text-primary" aria-hidden /> {f.label}
                </label>
                <div className={cn("flex items-center rounded-full border bg-subtle pr-2.5 transition-colors focus-within:border-primary/50 focus-within:bg-surface", outOfSlider ? "border-warn/50" : "border-transparent")}>
                  <input
                    id={`in-${f.key}`}
                    type="number"
                    inputMode="decimal"
                    step={f.step}
                    value={Number(v.toFixed(f.digits))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n > 0) onChange({ ...value, [f.key]: n });
                    }}
                    className="num w-[62px] bg-transparent py-1 pl-3 text-right text-[13px] font-bold text-ink outline-none focus-visible:outline-none"
                  />
                  <span className="w-8 pl-1 text-[11px] text-muted">{f.unit}</span>
                </div>
              </div>
              <Slider
                aria-label={f.label}
                min={f.min}
                max={f.max}
                step={f.step}
                value={[Math.min(Math.max(v, f.min), f.max)]}
                onValueChange={([n]) => onChange({ ...value, [f.key]: n })}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 min-h-[22px] text-xs" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {flags.length === 0 ? (
            <motion.p key="ok" {...fadeUp} className="flex items-center gap-1.5 font-medium text-ok">
              <CheckCircle2 className="size-3.5" /> Di dalam jendela operasi ≥95%
            </motion.p>
          ) : (
            <motion.ul key={flags.join()} {...fadeUp} className="space-y-1">
              {flags.map((f) => (
                <li key={f} className="flex items-start gap-1.5 font-medium text-warn">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" /> {FLAG_TEXT[f](sol)}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
