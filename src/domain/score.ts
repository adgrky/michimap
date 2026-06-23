// 訪問スコア・達成率の計算(SPEC §A3 W2)。michimap 固有(駅数ベース)。
import type { StationMeta, Visit } from "./types";

/** 訪問済(visits に存在)の駅数。 */
export function visitedCount(visits: Record<string, Visit>): number {
  return Object.keys(visits).length;
}

/** 全国達成率(0〜1)= 訪問数 / 総駅数。 */
export function nationalRatio(meta: StationMeta, visits: Record<string, Visit>): number {
  const total = meta.totals.pointCount;
  if (total <= 0) return 0;
  return visitedCount(visits) / total;
}

/** 制覇まで残りの駅数。 */
export function remaining(meta: StationMeta, visits: Record<string, Visit>): number {
  return Math.max(0, meta.totals.pointCount - visitedCount(visits));
}

/** 訪問した都道府県の数(都道府県横断称号用)。 */
export function visitedPrefCount(meta: StationMeta, visits: Record<string, Visit>): number {
  const set = new Set<string>();
  for (const id of Object.keys(visits)) {
    const p = meta.points[id];
    if (p) set.add(p.pref);
  }
  return set.size;
}

/** 都道府県別達成率(0〜1)。 */
export function prefCompletion(meta: StationMeta, visits: Record<string, Visit>): Record<string, number> {
  const visitedByPref: Record<string, number> = {};
  for (const id of Object.keys(visits)) {
    const p = meta.points[id];
    if (p) visitedByPref[p.pref] = (visitedByPref[p.pref] ?? 0) + 1;
  }
  const out: Record<string, number> = {};
  for (const [pref, total] of Object.entries(meta.totals.byPref)) {
    out[pref] = total > 0 ? (visitedByPref[pref] ?? 0) / total : 0;
  }
  return out;
}
