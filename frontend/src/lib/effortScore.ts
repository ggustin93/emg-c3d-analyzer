// Mapping from post-session RPE (Borg CR10, 0-10) to S_e (effort score in %)
// Based on memory-bank/metricsDefinitions.md §3.3
//  - 4–6  -> 100%
//  - {3,7} -> 80%
//  - {2,8} -> 60%
//  - {0,1,9,10} -> 20%

export function getEffortScoreFromRPE(postSessionRpe?: number | null): number {
  if (postSessionRpe === null || postSessionRpe === undefined) return 0;
  const rpe = Math.max(0, Math.min(10, Number(postSessionRpe)));
  if (rpe >= 4 && rpe <= 6) return 100;
  if (rpe === 3 || rpe === 7) return 80;
  if (rpe === 2 || rpe === 8) return 60;
  // 0,1,9,10
  return 20;
}


