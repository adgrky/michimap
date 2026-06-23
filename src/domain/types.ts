// michimap ドメイン型(SPEC §A3 / §E4)。POINT モード(クラスタリング)。
import type { SaveDataBase } from "@fillmap/core/generic";

/** 道の駅メタ(meta.json)。preprocess_point.py が生成。 */
export type StationMeta = {
  points: Record<string, StationInfo>;
  totals: {
    pointCount: number;
    byPref: Record<string, number>;
  };
};

export type StationInfo = {
  name: string;
  pref: string;
};

/** 1駅の訪問記録(§E4 visits)。visits に存在する=訪問済(スタンプ済)。 */
export type Visit = {
  count: number;
  firstDate?: string;
  memo?: string;
};

/** localStorage 保存データ。 */
export type StationSaveData = SaveDataBase & {
  visits: Record<string, Visit>;
};
