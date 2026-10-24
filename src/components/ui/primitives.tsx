/**
 * Design-system primitives (shadcn/ui API shape, Radix underneath), styled for
 * the light, rounded theme. Every interactive element has hover, press and a
 * visible keyboard-focus state.
 */
"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion, useSpring, useTransform, useReducedMotion } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import { cn, LOCALE } from "@/lib/utils";

/** Shared motion presets. Enter 220 ms, exit faster; no overshoot on data UI. */
export const ease = [0.2, 0.8, 0.2, 1] as const;
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease } },
};

// --- Button ------------------------------------------------------------------
const buttonVariants = cva(
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-[13px] font-semibold transition-[background,box-shadow,color,border-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-[0_8px_18px_-8px_rgb(37_99_235/0.7)] hover:bg-primary-600",
        soft: "bg-primary-soft text-primary hover:bg-[#dbe8ff]",
        secondary: "border border-line-strong bg-surface text-ink hover:border-primary/40 hover:text-primary",
        ghost: "text-muted hover:bg-subtle hover:text-ink",
      },
      size: { md: "h-10 px-4", sm: "h-8 px-3.5", xs: "h-7 px-3 text-xs", icon: "size-10", "icon-sm": "size-8" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild,
  ...p
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...p} />;
}

// --- Badge -------------------------------------------------------------------
const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5", {
  variants: {
    tone: {
      primary: "bg-primary-soft text-primary",
      indigo: "bg-indigo/10 text-indigo",
      ok: "bg-ok/10 text-ok",
      warn: "bg-warn/10 text-warn",
      bad: "bg-bad/10 text-bad",
      muted: "bg-subtle text-muted",
      glass: "bg-white/70 text-ink backdrop-blur",
    },
  },
  defaultVariants: { tone: "muted" },
});
export function Badge({ className, tone, ...p }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

// --- Input -------------------------------------------------------------------
export function Input({ className, ...p }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-full border border-line bg-subtle px-4 text-[13px] text-ink outline-none transition placeholder:text-muted hover:border-line-strong focus:border-primary/50 focus:bg-surface focus:shadow-[0_0_0_4px_rgb(37_99_235/0.10)] focus-visible:outline-none",
        className,
      )}
      {...p}
    />
  );
}

// --- Slider ------------------------------------------------------------------
export function Slider({ className, ...p }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn("relative flex h-6 w-full cursor-pointer touch-none select-none items-center", className)} {...p}>
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={p["aria-label"]}
        className="block size-5 rounded-full border-[3px] border-white bg-primary shadow-[0_2px_8px_rgb(37_99_235/0.45)] transition-shadow duration-150 hover:shadow-[0_0_0_6px_rgb(37_99_235/0.15)] focus-visible:shadow-[0_0_0_6px_rgb(37_99_235/0.25)] focus-visible:outline-none"
      />
    </SliderPrimitive.Root>
  );
}

// --- Segmented tabs with a shared animated indicator -------------------------
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  id: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-full bg-subtle p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative cursor-pointer whitespace-nowrap rounded-full font-semibold transition-colors duration-150",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-[13px]",
              active ? "text-primary" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-surface shadow-[0_2px_8px_-2px_rgb(27_37_65/0.15)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Panel: the one card surface, optionally collapsible --------------------
export function Panel({
  title,
  subtitle,
  icon: Icon,
  actions,
  collapsible = false,
  defaultOpen = true,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const bodyId = React.useId();
  return (
    <section className={cn("panel", className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-5">
        <div className="flex min-w-0 grow basis-[240px] items-center gap-3">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
              <Icon className="size-4 text-primary" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-ink">{title}</h3>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        {collapsible && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? "Ciutkan panel" : "Bentangkan panel"}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown className={cn("transition-transform duration-200", !open && "-rotate-90")} />
          </Button>
        )}
      </header>
      <div id={bodyId} className="collapse-body" data-closed={!open}>
        <div>
          <div className={cn("p-5", bodyClassName)}>{children}</div>
        </div>
      </div>
    </section>
  );
}

// --- Animated number (spring-interpolated, tabular) -------------------------
export function AnimatedNumber({ value, digits = 1, className }: { value: number; digits?: number; className?: string }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 });
  const text = useTransform(spring, (v) => v.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  React.useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);
  return <motion.span className={cn("num", className)}>{text}</motion.span>;
}

// --- Skeleton ----------------------------------------------------------------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-line", className)} />;
}

// --- Sheet (right drawer) ----------------------------------------------------
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className="fixed inset-y-2 right-2 z-50 flex w-[calc(100%-16px)] max-w-[640px] flex-col overflow-hidden rounded-[22px] bg-surface shadow-2xl focus-visible:outline-2 focus-visible:outline-primary"
                initial={{ x: "105%" }}
                animate={{ x: 0, transition: { duration: 0.32, ease } }}
                exit={{ x: "105%", transition: { duration: 0.2, ease } }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                  <div>
                    <DialogPrimitive.Title className="text-lg font-bold text-ink">{title}</DialogPrimitive.Title>
                    {description && <DialogPrimitive.Description className="mt-0.5 text-[13px] text-muted">{description}</DialogPrimitive.Description>}
                  </div>
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Tutup">
                      <X />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

// --- Stat (label + value + unit) --------------------------------------------
export function Stat({ label, value, unit, hint, tone }: { label: string; value: React.ReactNode; unit?: string; hint?: React.ReactNode; tone?: "primary" | "warn" | "bad" | "ok" }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className={cn(
            "num text-lg font-bold text-ink",
            tone === "primary" && "text-primary",
            tone === "warn" && "text-warn",
            tone === "bad" && "text-bad",
            tone === "ok" && "text-ok",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
