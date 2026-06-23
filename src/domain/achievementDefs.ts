// michimap 称号定義(SPEC §A3)。汎用 AchievementDef<StationStats> を使う。
import type { AchievementDef } from "@fillmap/core/generic";
import type { StationMeta, Visit } from "./types";
import { nationalRatio, prefCompletion, visitedCount, visitedPrefCount } from "./score";

/** 称号判定に使う統計値セット。 */
export type StationStats = {
  visitedCount: number;
  nationalRatio: number;
  visitedPrefCount: number;
  hokkaidoCompletion: number; // 北海道の達成率(北海道制覇用)
};

export function buildStationStats(meta: StationMeta, visits: Record<string, Visit>): StationStats {
  const prefs = prefCompletion(meta, visits);
  return {
    visitedCount: visitedCount(visits),
    nationalRatio: nationalRatio(meta, visits),
    visitedPrefCount: visitedPrefCount(meta, visits),
    hokkaidoCompletion: prefs["北海道"] ?? 0,
  };
}

export const stationAchievements: AchievementDef<StationStats>[] = [
  { id: "first", name: "道の駅デビュー", condition: "1駅を記録", check: (s) => s.visitedCount >= 1 },
  { id: "club100", name: "100駅クラブ", condition: "100駅を訪問", check: (s) => s.visitedCount >= 100 },
  { id: "hokkaido", name: "北海道ブロック制覇", condition: "北海道の道の駅を100%", check: (s) => s.hokkaidoCompletion >= 1 },
  { id: "cross20", name: "都道府県横断", condition: "20都道府県で記録", check: (s) => s.visitedPrefCount >= 20 },
  { id: "complete", name: "全国制覇", condition: "全駅を訪問", check: (s) => s.nationalRatio >= 1 },
];
