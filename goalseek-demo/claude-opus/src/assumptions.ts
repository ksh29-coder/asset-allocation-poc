/**
 * Income and tax assumptions.
 *
 * prices.csv is adjusted close on a TOTAL-RETURN basis — distributions are
 * reinvested into the price series, so the file contains no separable income
 * stream. Yield therefore cannot be derived from data/; it has to be an
 * explicit, stated assumption. These are indicative trailing-12-month
 * distribution yields by strategy type, and every one of them is exposed on
 * screen and editable by the advisor, so nothing here is hidden.
 *
 * taxChar splits each fund's distribution into the buckets that matter for a
 * high-bracket taxable investor.
 */
export interface Assumption {
  yieldPct: number;
  /** fractions summing to 1: ordinary income / qualified dividend / tax-exempt */
  ordinary: number; qualified: number; exempt: number;
  note: string;
}

export const YIELD_ASSUMPTIONS: Record<string, Assumption> = {
  JGRO: { yieldPct: 0.4, ordinary: 0.0, qualified: 1.0, exempt: 0, note: 'Growth equity — minimal distribution' },
  JAVA: { yieldPct: 1.7, ordinary: 0.0, qualified: 1.0, exempt: 0, note: 'Value equity dividends' },
  JMEE: { yieldPct: 1.3, ordinary: 0.0, qualified: 1.0, exempt: 0, note: 'SMID equity dividends' },
  JIRE: { yieldPct: 2.9, ordinary: 0.15, qualified: 0.85, exempt: 0, note: 'Developed ex-US pays more than US equity' },
  JGLO: { yieldPct: 1.6, ordinary: 0.1, qualified: 0.9, exempt: 0, note: 'Global blend' },
  JEMA: { yieldPct: 2.4, ordinary: 0.3, qualified: 0.7, exempt: 0, note: 'EM equity; partial foreign withholding' },
  BBRE: { yieldPct: 3.4, ordinary: 0.9, qualified: 0.1, exempt: 0, note: 'REIT distributions largely non-qualified' },
  JEPI: { yieldPct: 7.5, ordinary: 0.8, qualified: 0.2, exempt: 0, note: 'Covered-call premium is ordinary income' },
  JEPQ: { yieldPct: 9.5, ordinary: 0.85, qualified: 0.15, exempt: 0, note: 'Covered-call premium is ordinary income' },
  HELO: { yieldPct: 1.0, ordinary: 0.2, qualified: 0.8, exempt: 0, note: 'Hedged equity; options overlay funds the collar' },
  JPST: { yieldPct: 4.9, ordinary: 1.0, qualified: 0, exempt: 0, note: 'Ultra-short credit; fully taxable' },
  JMST: { yieldPct: 3.2, ordinary: 0, qualified: 0, exempt: 1.0, note: 'Municipal — federally tax-exempt' },
  JAGG: { yieldPct: 3.9, ordinary: 1.0, qualified: 0, exempt: 0, note: 'Core aggregate bond' },
  JCPB: { yieldPct: 4.6, ordinary: 1.0, qualified: 0, exempt: 0, note: 'Core plus, credit tilt' },
  JBND: { yieldPct: 4.4, ordinary: 1.0, qualified: 0, exempt: 0, note: 'Active core bond' },
  JPIE: { yieldPct: 5.9, ordinary: 1.0, qualified: 0, exempt: 0, note: 'Multi-sector income; high-yield sleeve' },
};

/** Top federal marginal rates incl. 3.8% NIIT — high-bracket taxable couple. */
export const TAX_RATES = { ordinary: 0.408, qualified: 0.238, exempt: 0.0 };
