export interface Check {
  isUp: boolean;
  status: number | null;
  latencyMs?: number;
  error?: string;
}

export const decideIncident = (
  recent: Check[],
  hasOpenIncident: boolean
): 'open' | 'close' | 'none' => {
  const last3 = recent.slice(0, 3);
  if (!hasOpenIncident && last3.length === 3 && last3.every((c) => !c.isUp)) {
    return 'open';
  }
  const last2 = recent.slice(0, 2);
  if (hasOpenIncident && last2.length === 2 && last2.every((c) => c.isUp)) {
    return 'close';
  }

  return 'none';
};
