// 道の駅タップ時のボトムシート(SPEC §E2/§A3)。訪問トグル+訪問日/回数/メモ。
import type { StationInfo, Visit } from "../domain/types";

type Props = {
  info: StationInfo;
  visit: Visit | undefined; // undefined = 未訪問
  onToggle: () => void;
  onUpdate: (patch: Partial<Visit>) => void;
  onClose: () => void;
};

export function PointSheet({ info, visit, onToggle, onUpdate, onClose }: Props) {
  const visited = Boolean(visit);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-[#11151c] p-4 pb-6 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">道の駅 {info.name}</h2>
          <p className="text-xs text-[#8b93a3]">{info.pref}</p>
        </div>
        <button onClick={onClose} className="px-2 text-2xl leading-none text-[#8b93a3]" aria-label="閉じる">
          ×
        </button>
      </div>

      {/* 訪問トグル */}
      <button
        onClick={onToggle}
        className={`w-full rounded-xl py-3 text-base font-bold transition ${
          visited ? "bg-[#1e2530] text-[#8b93a3]" : "bg-orange-400 text-[#0b0e14]"
        }`}
      >
        {visited ? "訪問を取り消す" : "🅿 行った！"}
      </button>

      {/* 訪問済の詳細 */}
      {visited && visit && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="w-16 text-xs text-[#8b93a3]">訪問日</label>
            <input
              type="date"
              value={visit.firstDate ?? ""}
              onChange={(e) => onUpdate({ firstDate: e.target.value })}
              className="flex-1 rounded-lg bg-[#1e2530] px-3 py-2 text-sm text-[#e8ecf4] outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="w-16 text-xs text-[#8b93a3]">訪問回数</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onUpdate({ count: Math.max(1, visit.count - 1) })}
                className="h-8 w-8 rounded-lg bg-[#1e2530] text-lg leading-none text-[#e8ecf4]"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold">{visit.count}</span>
              <button
                onClick={() => onUpdate({ count: visit.count + 1 })}
                className="h-8 w-8 rounded-lg bg-[#1e2530] text-lg leading-none text-[#e8ecf4]"
              >
                ＋
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#8b93a3]">メモ(140字)</label>
            <textarea
              value={visit.memo ?? ""}
              maxLength={140}
              rows={2}
              onChange={(e) => onUpdate({ memo: e.target.value })}
              placeholder="買ったもの・グルメ・スタンプの感想など"
              className="w-full resize-none rounded-lg bg-[#1e2530] px-3 py-2 text-sm text-[#e8ecf4] outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
