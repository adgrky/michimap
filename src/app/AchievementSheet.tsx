// 称号一覧シート(SPEC §A3)。解除済み/未解除を一覧表示。
import { stationAchievements } from "../domain/achievementDefs";

type Props = {
  unlocked: Record<string, string>; // id → 解除日時文字列
  onClose: () => void;
};

export function AchievementSheet({ unlocked, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#0b0e14]/95 backdrop-blur">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#222834]">
        <h2 className="text-lg font-bold">称号一覧</h2>
        <button
          onClick={onClose}
          className="text-2xl leading-none text-[#8b93a3] hover:text-white transition-colors"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {stationAchievements.map((a) => {
          const date = unlocked[a.id];
          const isUnlocked = Boolean(date);
          const isGold = a.id === "complete";
          return (
            <div
              key={a.id}
              className={`flex items-center gap-4 rounded-xl px-4 py-3 ${
                isUnlocked ? "bg-[#2a210f]" : "bg-[#151a23] opacity-60"
              }`}
            >
              <span className="text-2xl w-8 text-center">
                {isUnlocked ? (isGold ? "👑" : "🏆") : "🔒"}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`font-bold ${isUnlocked ? "text-amber-300" : "text-[#8b93a3]"}`}>
                  {a.name}
                </div>
                <div className="text-xs text-[#8b93a3] mt-0.5">{a.condition}</div>
                {isUnlocked && (
                  <div className="text-xs text-[#a3792a] mt-1">
                    {new Date(date).toLocaleDateString("ja-JP")} 解除
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
