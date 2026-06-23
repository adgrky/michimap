// @fillmap/core 汎用層。アプリ非依存(LINE/POINT/POLYGON 共通)。
// railmap から2本目(citymap)を作る際に「真に共通な部分」だけをここへ抽出した。
// 各アプリの domain(types/store/達成率/換算)はアプリ側に持つ。

// --- 共通保存データの基底(SPEC §E4) ---
export type ThemeColor = string; // アプリごとにアクセント色を自由設定
export type BaseSettings = { theme: ThemeColor; sound: boolean };

/** 全アプリ共通のセーブデータ土台。各アプリは塗り状態(rides/visits等)を交差型で足す。 */
export type SaveDataBase = {
  version: number;
  updatedAt: string; // ISO8601
  settings: BaseSettings;
  unlockedAchievements: Record<string, string>; // id -> 解除日時
};

// --- 汎用 localStorage 永続化(キー注入式・debounce・破損フォールバック) ---
type PersistenceOptions<T extends SaveDataBase> = {
  /** localStorage キー(アプリごとに一意。例 "citymap.v1") */
  storageKey: string;
  /** 期待する version。読み込み時の検証に使う。 */
  version: number;
  /** 初期データ(破損/未保存時のフォールバック)。 */
  createInitial: () => T;
  /** version 一致時の健全性チェック+正規化(壊れていれば null を返し初期化)。 */
  normalize: (raw: unknown) => T | null;
};

export type Persistence<T extends SaveDataBase> = {
  load: () => T;
  save: (data: T) => void; // debounce 300ms
  exportJson: (data: T) => string;
  parseImported: (text: string) => T | null;
};

/** アプリ非依存の永続化を生成する。SPEC §4(保存) / §13(破損でも起動)。 */
export function createPersistence<T extends SaveDataBase>(opts: PersistenceOptions<T>): Persistence<T> {
  const { storageKey, version, createInitial, normalize } = opts;

  function migrate(raw: unknown): T {
    if (!raw || typeof raw !== "object") return createInitial();
    const v = (raw as { version?: number }).version;
    if (v !== version) return createInitial(); // 将来は version 別分岐をここに
    return normalize(raw) ?? createInitial();
  }

  function load(): T {
    try {
      const text = localStorage.getItem(storageKey);
      if (!text) return createInitial();
      return migrate(JSON.parse(text));
    } catch {
      return createInitial();
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  function save(data: T): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const payload = { ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // 容量超過等は無視
      }
    }, 300);
  }

  function exportJson(data: T): string {
    return JSON.stringify(data, null, 2);
  }

  function parseImported(text: string): T | null {
    try {
      const obj = JSON.parse(text);
      if (!obj || obj.version !== version) return null;
      return migrate(obj);
    } catch {
      return null;
    }
  }

  return { load, save, exportJson, parseImported };
}

// --- 汎用 称号エンジン(SPEC §9)。stats の型 S はアプリが決める ---
export type AchievementDef<S> = {
  id: string;
  name: string;
  condition: string; // 画面表示用テキスト
  check: (stats: S) => boolean;
};

/** 未解除の称号を評価し、新規解除 id を返す純関数。呼び出し側が保存する。 */
export function checkNewAchievements<S>(
  defs: AchievementDef<S>[],
  stats: S,
  already: Record<string, string>
): string[] {
  const out: string[] = [];
  for (const def of defs) {
    if (!already[def.id] && def.check(stats)) out.push(def.id);
  }
  return out;
}

// --- 汎用シェア画像(SPEC §10 / §E5)。文言・数値表現はアプリが注入 ---
export type ShareImageOptions = {
  mapCanvas: HTMLCanvasElement;
  themeColor: string;
  /** 左下メイン(大きく強調)。例「全国 18.2%」「34/100座」 */
  mainText: string;
  /** 左下サブ(小さく)。例「総走破 1,200km 東京↔大阪 約2.2往復分」 */
  subText: string;
  /** 右下フッター(アプリ名/ブランド。00_master §3 統一ロゴ枠) */
  footerLabel: string;
  /** 称号バリアント: 中央に称号名+ゴールド枠。省略時は通常バリアント。 */
  achievementName?: string;
  /** 称号バリアントのサブ文言。例「市区町村マップで解除しました」 */
  achievementSuffix?: string;
};

const SHARE_W = 1200;
const SHARE_H = 630;

/** OGP(1200×630)PNG Blob を生成。2秒以内完了が要件(§10)。 */
export async function drawShareImage(opts: ShareImageOptions): Promise<Blob> {
  const { mapCanvas, themeColor, mainText, subText, footerLabel, achievementName, achievementSuffix } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d")!;
  const FONT = "-apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";

  // 背景
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // 地図スナップ(中央クロップ・縦横比保持)
  const scale = Math.max(SHARE_W / mapCanvas.width, SHARE_H / mapCanvas.height);
  const dw = mapCanvas.width * scale;
  const dh = mapCanvas.height * scale;
  ctx.globalAlpha = 0.7;
  ctx.drawImage(mapCanvas, (SHARE_W - dw) / 2, (SHARE_H - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;

  // 下半分を暗くするグラデ
  const grad = ctx.createLinearGradient(0, SHARE_H * 0.4, 0, SHARE_H);
  grad.addColorStop(0, "rgba(11,14,20,0)");
  grad.addColorStop(1, "rgba(11,14,20,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  if (achievementName) {
    const bw = 700, bh = 120;
    const bx = (SHARE_W - bw) / 2, by = (SHARE_H - bh) / 2;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 20;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(11,14,20,0.85)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold 36px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🏆 ${achievementName}`, SHARE_W / 2, SHARE_H / 2 - 8);
    if (achievementSuffix) {
      ctx.fillStyle = "#8b93a3";
      ctx.font = `18px ${FONT}`;
      ctx.fillText(achievementSuffix, SHARE_W / 2, SHARE_H / 2 + 34);
    }
  } else {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = themeColor;
    ctx.font = `bold 72px ${FONT}`;
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 16;
    ctx.fillText(mainText, 56, SHARE_H - 96);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e8ecf4";
    ctx.font = `24px ${FONT}`;
    ctx.fillText(subText, 56, SHARE_H - 52);
  }

  // 右下フッター(両バリアント共通)
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#8b93a3";
  ctx.font = `18px ${FONT}`;
  ctx.fillText(footerLabel, SHARE_W - 40, SHARE_H - 40);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png");
  });
}

/** PNG Blob を filename でダウンロード。 */
export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Web Share API でシェア(未対応はダウンロードにフォールバック)。 */
export async function shareOrDownloadImage(blob: Blob, filename: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
  } else {
    downloadPng(blob, filename);
  }
}

/** 達成率の表示用文字列(§8.1)。0%超〜0.05%は「0.1%未満」(ゼロに見せない)。 */
export function formatRatio(ratio: number): string {
  const pct = ratio * 100;
  if (pct <= 0) return "0%";
  if (pct < 0.05) return "0.1%未満";
  return `${pct.toFixed(1)}%`;
}

// --- 広告除外(買い切り課金)。サーバーなし構成のため、Stripe決済リンクで購入→
// 表示された解除コードを手入力→ハッシュ一致で localStorage に premium フラグを立てる方式。
// 各アプリの SPEC.md に例外として明記した上で使用する(外部送信は決済リンク遷移のみ・本体は通信しない)。
const PREMIUM_SUFFIX = ".premium_v1";

/** 広告が外れているか(premium フラグ)。storageKey はアプリの保存キーと揃える(例 "citymap.v1")。 */
export function isPremium(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey + PREMIUM_SUFFIX) === "1";
  } catch {
    return false;
  }
}

/** premium フラグを立てる(復元・デバッグ用に直接呼ぶこともある)。 */
export function setPremium(storageKey: string): void {
  try {
    localStorage.setItem(storageKey + PREMIUM_SUFFIX, "1");
  } catch {
    // 容量超過等は無視
  }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 解除コードを検証して premium フラグを立てる。
 * コード本体はソースに含めず、期待ハッシュ(SHA-256)だけを各アプリ側で env から渡す。
 */
export async function redeemPremiumCode(
  storageKey: string,
  code: string,
  expectedHash: string
): Promise<boolean> {
  if (!code.trim() || !expectedHash) return false;
  const hash = await sha256Hex(code);
  if (hash === expectedHash) {
    setPremium(storageKey);
    return true;
  }
  return false;
}
