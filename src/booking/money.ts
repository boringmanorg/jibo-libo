/** All booking money is held in integer paise (1 INR = 100 paise), so totals never drift. */
export type Paise = number;

export const rupees = (inr: number): Paise => Math.round(inr * 100);

/** Basis points: 1% = 100 bps. Rounds half away from zero to the nearest paisa. */
export const applyBps = (amount: Paise, bps: number): Paise => Math.round((amount * bps) / 10_000);

export const formatInr = (amount: Paise): string => {
  const inr = amount / 100;
  return `₹${inr.toLocaleString('en-IN', { minimumFractionDigits: amount % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
};
