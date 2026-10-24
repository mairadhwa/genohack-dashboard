/**
 * Mechanistic GOS kinetics — TypeScript port of gos/src/gos_kinetics.py.
 *
 * Five state variables (mM): lactose, glucose, galactose, GOS, active enzyme.
 *
 *   E + Lactose  -> E-Gal + Glucose        (donor pathway 1)
 *   E + GOS      -> E-Gal + Lactose        (donor pathway 2 = GOS breakdown)
 *   E-Gal + H2O      -> E + Galactose      (hydrolysis, loss)
 *   E-Gal + Lactose  -> E + GOS            (transgalactosylation, gain)
 *
 * Galactose inhibits competitively; the enzyme deactivates thermally (1st order).
 * GOS is an intermediate product, so yield peaks and then falls — harvest timing matters.
 *
 * Pure functions, no imports: shared by the browser, the API route, and scripts/validate-model.ts.
 */

export const MW = { LAC: 342.3, GLC: 180.16, GAL: 180.16, GOS: 504.44 } as const;
const R_GAS = 8.314;

export interface KineticParams {
  Km_lac: number; // mM
  Ki_gal: number; // mM
  kcat_lac: number; // 1/s at T_ref
  kcat_gos: number; // 1/s at T_ref
  Km_gos: number; // mM
  K_acc: number; // mM, acceptor competition lactose vs water
  Ea_sel: number; // J/mol
  pH_opt_sel: number;
  pH_width_sel: number;
  Ea_cat: number; // J/mol
  Ea_deact: number; // J/mol
  kd_ref: number; // 1/h at T_ref
  T_ref: number; // K
  pH_opt: number;
  pH_width: number;
}

/** F441Y mutant parameters (gos/hasil/parameter_F441Y.csv). */
export const PARAMS_F441Y: KineticParams = {
  Km_lac: 26.3,
  Ki_gal: 6.0,
  kcat_lac: 2.67,
  kcat_gos: 60.0,
  Km_gos: 220.0,
  K_acc: 18.904364002605156,
  Ea_sel: 26000.0,
  pH_opt_sel: 6.0,
  pH_width_sel: 1.4,
  Ea_cat: 48000.0,
  Ea_deact: 213000.0,
  kd_ref: 0.009627044174443685,
  T_ref: 353.15,
  pH_opt: 6.0,
  pH_width: 1.1,
};

/** Wild-type parameters: identical except the acceptor constant (gos/hasil/parameter_WT.csv). */
export const PARAMS_WT: KineticParams = { ...PARAMS_F441Y, K_acc: 60.53439103802864 };

/** Enzyme dose conversion calibrated in kalibrasi_lacs.py: 9 U/mL = 0.0072453 mM. */
export const ENZYME_MM_PER_U_ML = 0.00724532003822082 / 9;

export interface Conditions {
  lactose_g_L: number;
  temperature_C: number;
  pH: number;
  enzyme_U_mL: number;
}

export interface TrajectoryPoint {
  t: number; // h
  yield_pct: number; // GOS, % w/w of initial lactose
  gos: number; // g/L
  lactose: number; // g/L
  glucose: number; // g/L
  galactose: number; // g/L
  conversion_pct: number;
  enzyme_pct: number; // active enzyme remaining
}

export interface PeakSummary {
  peak_yield_pct: number;
  peak_time_h: number;
  peak_gos_g_L: number;
  productivity_g_L_h: number;
  enzyme_remaining_pct: number;
  conversion_at_peak_pct: number;
  /** Yield points lost if harvest is delayed by 6/12/24 h. */
  loss_pts: { 6: number; 12: number; 24: number };
  /** GOS g/L lost if harvest is delayed by 6/12/24 h. */
  loss_g_L: { 6: number; 12: number; 24: number };
}

// ---------------------------------------------------------------------------
// Temperature / pH terms
// ---------------------------------------------------------------------------
const tempFactor = (T_C: number, p: KineticParams) =>
  Math.exp((-p.Ea_cat / R_GAS) * (1 / (T_C + 273.15) - 1 / p.T_ref));

export const deactivationRate = (T_C: number, p: KineticParams) =>
  p.kd_ref * Math.exp((-p.Ea_deact / R_GAS) * (1 / (T_C + 273.15) - 1 / p.T_ref));

const pHFactor = (pH: number, p: KineticParams) => Math.exp(-0.5 * ((pH - p.pH_opt) / p.pH_width) ** 2);

/** Effective acceptor constant: small = lactose wins over water = more GOS. */
export const effectiveKacc = (T_C: number, pH: number, p: KineticParams) => {
  const fT = Math.exp((p.Ea_sel / R_GAS) * (1 / (T_C + 273.15) - 1 / p.T_ref));
  const fpH = Math.exp(0.5 * ((pH - p.pH_opt_sel) / p.pH_width_sel) ** 2);
  return p.K_acc * fT * fpH;
};

// ---------------------------------------------------------------------------
// ODE right-hand side. y = [Lac, Glc, Gal, GOS, E] in mM, t in hours.
// ---------------------------------------------------------------------------
function makeRhs(T_C: number, pH: number, p: KineticParams) {
  const scale = tempFactor(T_C, p) * pHFactor(pH, p) * 3600; // 1/s -> 1/h
  const kLac = p.kcat_lac * scale;
  const kGos = p.kcat_gos * scale;
  const Kacc = effectiveKacc(T_C, pH, p);
  const kd = deactivationRate(T_C, p);

  return (y: number[], out: number[]) => {
    const Lac = Math.max(y[0], 0);
    const Gal = Math.max(y[2], 0);
    const GOS = Math.max(y[3], 0);
    const E = Math.max(y[4], 0);

    const inhib = 1 + Gal / p.Ki_gal;
    const KmLac = p.Km_lac * inhib;
    const KmGos = p.Km_gos * inhib;
    const D = 1 + Lac / KmLac + GOS / KmGos;

    const vLac = (kLac * E * (Lac / KmLac)) / D;
    const vGos = (kGos * E * (GOS / KmGos)) / D;
    const vTot = vLac + vGos;
    const pTrans = Lac / (Kacc + Lac);

    out[0] = -vLac + vGos - pTrans * vTot;
    out[1] = vLac;
    out[2] = (1 - pTrans) * vTot;
    out[3] = pTrans * vTot - vGos;
    out[4] = -kd * E;
  };
}

/**
 * Integrate one batch with classic RK4 (dt = 0.01 h is well below the fastest
 * time constant here, ~0.3 h; agreement with SciPy LSODA is checked in
 * scripts/validate-model.ts).
 */
export function simulate(
  c: Conditions,
  opts: { tMax?: number; sampleEvery?: number; params?: KineticParams } = {},
): TrajectoryPoint[] {
  const { tMax = 72, sampleEvery = 0.25, params = PARAMS_F441Y } = opts;
  const dt = 0.01;
  const E0 = c.enzyme_U_mL * ENZYME_MM_PER_U_ML;
  const Lac0 = (c.lactose_g_L / MW.LAC) * 1000;
  const rhs = makeRhs(c.temperature_C, c.pH, params);

  let y = [Lac0, 0, 0, 0, E0];
  const k1 = new Array(5), k2 = new Array(5), k3 = new Array(5), k4 = new Array(5), tmp = new Array(5);
  const steps = Math.round(tMax / dt);
  const every = Math.max(1, Math.round(sampleEvery / dt));
  const pts: TrajectoryPoint[] = [];

  const record = (t: number, s: number[]) => {
    const [Lac, Glc, Gal, GOS, E] = s.map((v) => Math.max(v, 0));
    const gos = (GOS * MW.GOS) / 1000;
    pts.push({
      t,
      yield_pct: (gos / c.lactose_g_L) * 100,
      gos,
      lactose: (Lac * MW.LAC) / 1000,
      glucose: (Glc * MW.GLC) / 1000,
      galactose: (Gal * MW.GAL) / 1000,
      conversion_pct: (1 - Lac / Lac0) * 100,
      enzyme_pct: E0 > 0 ? (E / E0) * 100 : 0,
    });
  };

  record(0, y);
  for (let i = 1; i <= steps; i++) {
    rhs(y, k1);
    for (let j = 0; j < 5; j++) tmp[j] = y[j] + 0.5 * dt * k1[j];
    rhs(tmp, k2);
    for (let j = 0; j < 5; j++) tmp[j] = y[j] + 0.5 * dt * k2[j];
    rhs(tmp, k3);
    for (let j = 0; j < 5; j++) tmp[j] = y[j] + dt * k3[j];
    rhs(tmp, k4);
    y = y.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    if (i % every === 0) record(i * dt, y);
  }
  return pts;
}

/** Linear interpolation of a trajectory field at time t. */
function at(traj: TrajectoryPoint[], t: number, key: keyof TrajectoryPoint) {
  if (t <= traj[0].t) return traj[0][key];
  const last = traj[traj.length - 1];
  if (t >= last.t) return last[key];
  let lo = 0, hi = traj.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (traj[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = traj[lo], b = traj[hi];
  return a[key] + ((b[key] - a[key]) * (t - a.t)) / (b.t - a.t);
}

/** Peak yield, harvest time and late-harvest losses from a trajectory. */
export function summarize(traj: TrajectoryPoint[]): PeakSummary {
  let i = 0;
  for (let k = 1; k < traj.length; k++) if (traj[k].yield_pct > traj[i].yield_pct) i = k;
  const pk = traj[i];
  const lossPts = (h: number) => pk.yield_pct - at(traj, pk.t + h, "yield_pct");
  const lossG = (h: number) => pk.gos - at(traj, pk.t + h, "gos");
  return {
    peak_yield_pct: pk.yield_pct,
    peak_time_h: pk.t,
    peak_gos_g_L: pk.gos,
    productivity_g_L_h: pk.t > 0 ? pk.gos / pk.t : 0,
    enzyme_remaining_pct: pk.enzyme_pct,
    conversion_at_peak_pct: pk.conversion_pct,
    loss_pts: { 6: lossPts(6), 12: lossPts(12), 24: lossPts(24) },
    loss_g_L: { 6: lossG(6), 12: lossG(12), 24: lossG(24) },
  };
}

/**
 * Full prediction for one operating point. The horizon auto-extends so that
 * slow (cold / low-enzyme) batches still reach their peak plus 24 h of decline.
 */
export function predict(c: Conditions, params: KineticParams = PARAMS_F441Y) {
  let tMax = 72;
  let traj = simulate(c, { tMax, params, sampleEvery: 0.05 });
  let s = summarize(traj);
  while (s.peak_time_h > tMax - 25 && tMax < 400) {
    tMax *= 2;
    traj = simulate(c, { tMax, params, sampleEvery: 0.05 });
    s = summarize(traj);
  }
  return { trajectory: traj, summary: s, horizon_h: tMax };
}

// ---------------------------------------------------------------------------
// Operating envelope checks
// ---------------------------------------------------------------------------
/** Rough lactose solubility (g/L) used in kalibrasi_lacs.py. Placeholder correlation. */
export const lactoseSolubility = (T_C: number) => 117 * Math.exp(0.0266 * T_C);

export const OPERATING_WINDOW = {
  lactose: [500, 800],
  temperature: [70, 85],
  pH: [5.0, 6.5],
} as const;

/** Grid search bounds; outside these the model is extrapolating. */
export const GRID_BOUNDS = {
  lactose: [400, 800],
  temperature: [65, 85],
  pH: [4.5, 6.5],
} as const;

export function flagsFor(c: Conditions): string[] {
  const f: string[] = [];
  const inWin =
    c.lactose_g_L >= OPERATING_WINDOW.lactose[0] && c.lactose_g_L <= OPERATING_WINDOW.lactose[1] &&
    c.temperature_C >= OPERATING_WINDOW.temperature[0] && c.temperature_C <= OPERATING_WINDOW.temperature[1] &&
    c.pH >= OPERATING_WINDOW.pH[0] && c.pH <= OPERATING_WINDOW.pH[1];
  if (!inWin) f.push("outside_operating_window");
  if (c.lactose_g_L > lactoseSolubility(c.temperature_C)) f.push("above_solubility");
  if (
    c.lactose_g_L < GRID_BOUNDS.lactose[0] || c.lactose_g_L > GRID_BOUNDS.lactose[1] ||
    c.temperature_C < GRID_BOUNDS.temperature[0] || c.temperature_C > GRID_BOUNDS.temperature[1] ||
    c.pH < GRID_BOUNDS.pH[0] || c.pH > GRID_BOUNDS.pH[1]
  )
    f.push("extrapolation");
  return f;
}
