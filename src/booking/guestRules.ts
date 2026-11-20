/** Browser-safe guest rules shared by the booking page and the engine. */
export const isIndian = (nationality: string): boolean => /^(india|indian)$/i.test(nationality.trim());
