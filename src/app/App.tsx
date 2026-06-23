// michimap ルート(SPEC §A3)。スコアバー + 地図/リスト/年表/設定タブ + 訪問シート + 称号判定。
import { useCallback, useEffect, useRef, useState } from "react";
import { checkNewAchievements, formatRatio, isPremium } from "@fillmap/core/generic";
import { useStationStore } from "../domain/store";
import type { StationMeta } from "../domain/types";
import { nationalRatio, remaining, visitedCount } from "../domain/score";
import { buildStationStats, stationAchievements } from "../domain/achievementDefs";
import { THEME_DIM } from "../domain/theme";
import { MapView, type CaptureMapCallback } from "./MapView";
import { PointSheet } from "./PointSheet";
import { AchievementSheet } from "./AchievementSheet";
import { ListTab } from "./ListTab";
import { YearTab } from "./YearTab";
import { SettingsTab } from "./SettingsTab";
import { AdBanner } from "./AdBanner";

/** 数値をアニメーション付きで変化させる hook */
function useAnimatedNumber(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (prev.current === target) return;
    const start = prev.current;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      setDisplay(Math.round(start + (target - start) * t));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return display;
}

/** maplibre canvas を背景に統計テキストを合成してシェア/ダウンロード(SPEC §E5)。 */
async function compositeShareImage(
  mapCanvas: HTMLCanvasElement,
  visited: number,
  total: number,
  left: number,
): Promise<void> {
  const W = mapCanvas.width;
  const H = mapCanvas.height;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(mapCanvas, 0, 0);

  const barH = Math.round(H * 0.2);
  const grad = ctx.createLinearGradient(0, H - barH, 0, H);
  grad.addColorStop(0, "rgba(11,14,20,0)");
  grad.addColorStop(0.4, "rgba(11,14,20,0.82)");
  grad.addColorStop(1, "rgba(11,14,20,0.97)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - barH, W, barH);

  const line1 = `道の駅 ${visited} / ${total} 駅`;
  const line2 = visited > 0 ? `全国制覇まであと ${left.toLocaleString()} 駅` : "全国1,145駅、ここから始めよう";

  const fs1 = Math.round(W * 0.07);
  const fs2 = Math.round(W * 0.04);
  const baseY = H - Math.round(barH * 0.2);

  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 8;

  ctx.font = `bold ${fs1}px system-ui, sans-serif`;
  ctx.fillStyle = "#fdba74"; // orange-300
  ctx.fillText(line1, W / 2, baseY - fs2 - 6);

  ctx.font = `${fs2}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(line2, W / 2, baseY);

  ctx.shadowBlur = 0;

  const fsCredit = Math.round(W * 0.026);
  ctx.font = `${fsCredit}px system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("道の駅埋め立てマップ", W - Math.round(W * 0.025), H - Math.round(H * 0.02));

  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );

  const file = new File([blob], "michimap.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: line1 });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "michimap.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

type Tab = "map" | "list" | "year" | "settings";

export function App() {
  const data = useStationStore((s) => s.data);
  const isVisited = useStationStore((s) => s.isVisited);
  const toggleVisit = useStationStore((s) => s.toggleVisit);
  const updateVisit = useStationStore((s) => s.updateVisit);
  const unlockAchievement = useStationStore((s) => s.unlockAchievement);

  const [meta, setMeta] = useState<StationMeta | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const [premium, setPremiumState] = useState(() => isPremium("michimap.v1"));
  const [flash, setFlash] = useState(false);
  const [sharing, setSharing] = useState(false);

  const captureRef = useRef<CaptureMapCallback | null>(null);
  const applyVisitRef = useRef<((id: string, visited: boolean) => void) | null>(null);
  const playStampRef = useRef<((id: string) => void) | null>(null);

  useEffect(() => {
    fetch("./data/meta.json")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta({ points: {}, totals: { pointCount: 0, byPref: {} } }));
  }, []);

  const handleReady = useCallback(
    (
      capture: CaptureMapCallback,
      applyVisit: (id: string, visited: boolean) => void,
      playStamp: (id: string) => void,
    ) => {
      captureRef.current = capture;
      applyVisitRef.current = applyVisit;
      playStampRef.current = playStamp;
    },
    []
  );

  const runAchievementCheck = useCallback(() => {
    if (!meta) return;
    const visits = useStationStore.getState().data.visits;
    const stats = buildStationStats(meta, visits);
    const newly = checkNewAchievements(
      stationAchievements,
      stats,
      useStationStore.getState().data.unlockedAchievements
    );
    if (newly.length > 0) {
      for (const id of newly) unlockAchievement(id);
      const def = stationAchievements.find((a) => a.id === newly[0]);
      if (def) {
        setToast(`🏆 ${def.name}`);
        setTimeout(() => setToast(null), 2600);
      }
    }
  }, [meta, unlockAchievement]);

  /** 訪問トグル(地図・リスト・シート共通)。 */
  const handleToggle = useCallback(
    (id: string) => {
      const before = isVisited(id);
      toggleVisit(id);
      const now = !before;
      applyVisitRef.current?.(id, now);
      if (now && tab === "map") playStampRef.current?.(id);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
      runAchievementCheck();
    },
    [isVisited, toggleVisit, tab, runAchievementCheck]
  );

  const visited = visitedCount(data.visits);
  const total = meta?.totals.pointCount ?? 0;
  const ratio = meta ? nationalRatio(meta, data.visits) : 0;
  const left = meta ? remaining(meta, data.visits) : 0;

  const handleShare = useCallback(async () => {
    const canvas = captureRef.current?.();
    if (!canvas || sharing || tab !== "map" || !meta) return;
    setSharing(true);
    try {
      await compositeShareImage(canvas, visited, total, left);
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") console.error(e);
    } finally {
      setSharing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, tab, meta, visited, total, left]);

  const animVisited = useAnimatedNumber(visited);
  const animLeft = useAnimatedNumber(left);

  const selectedInfo = selected && meta ? meta.points[selected.id] : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 地図(常に保持、他タブ時は invisible で WebGL コンテキストを維持) */}
      <div className={tab === "map" ? "absolute inset-0" : "absolute inset-0 invisible"}>
        <MapView
          onSelect={(id, name) => setSelected({ id, name })}
          isVisited={isVisited}
          onReady={handleReady}
        />
      </div>

      {/* 上部スコアバー */}
      <div
        className={`absolute inset-x-0 top-0 z-10 m-3 rounded-2xl bg-[#11151c]/90 px-4 py-3 backdrop-blur transition-all duration-200 ${
          flash ? "ring-2 ring-orange-300/60 shadow-[0_0_16px_2px_rgba(251,146,60,0.3)]" : ""
        }`}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-base">
            道の駅 <b className="text-orange-300">{animVisited}</b>
            <span className="text-[#8b93a3]"> / {total || "—"}</span>
            <span className="ml-2 text-sm text-[#8b93a3]">({formatRatio(ratio)})</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8b93a3]">
              あと <b className="text-orange-300">{animLeft.toLocaleString()}</b> 駅
            </span>
            <button
              onClick={handleShare}
              disabled={sharing || tab !== "map"}
              className="text-lg leading-none opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
              aria-label="シェア画像を作成"
              title="地図をシェア"
            >
              {sharing ? "⏳" : "📤"}
            </button>
            <button
              onClick={() => setShowAchievements(true)}
              className="text-lg leading-none opacity-70 hover:opacity-100 transition-opacity"
              aria-label="称号一覧"
            >
              🏆
            </button>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#222834]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(ratio * 100, 100)}%`, background: THEME_DIM }}
          />
        </div>

        {/* タブバー */}
        <div className="mt-3 flex gap-1">
          {([
            ["map", "🗺 地図"],
            ["list", "📋 リスト"],
            ["year", "📅 年表"],
            ["settings", "⚙️ 設定"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                tab === t ? "bg-orange-400/20 text-orange-300" : "text-[#8b93a3] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* リストタブ */}
      {tab === "list" && meta && (
        <ListTab
          meta={meta}
          isVisited={isVisited}
          onToggle={handleToggle}
          onSelect={(id, name) => setSelected({ id, name })}
        />
      )}

      {/* 年表タブ */}
      {tab === "year" && meta && (
        <YearTab meta={meta} visits={data.visits} onSelect={(id, name) => setSelected({ id, name })} />
      )}

      {/* 設定タブ */}
      {tab === "settings" && (
        <SettingsTab premium={premium} onPremiumUnlocked={() => setPremiumState(true)} />
      )}

      {/* 広告バナー(premium 購入済みなら非表示) */}
      <AdBanner hidden={premium} />

      {/* 称号トースト */}
      {toast && (
        <div className="absolute left-1/2 top-28 z-30 -translate-x-1/2 rounded-full bg-amber-400 px-5 py-2 font-bold text-[#0b0e14] shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      {/* 訪問シート */}
      {selected && selectedInfo && (
        <PointSheet
          info={selectedInfo}
          visit={data.visits[selected.id]}
          onToggle={() => handleToggle(selected.id)}
          onUpdate={(patch) => updateVisit(selected.id, patch)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* 称号一覧シート */}
      {showAchievements && (
        <AchievementSheet
          unlocked={data.unlockedAchievements}
          onClose={() => setShowAchievements(false)}
        />
      )}
    </div>
  );
}
