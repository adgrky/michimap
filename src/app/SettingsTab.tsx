// 設定タブ。広告除外(買い切り)の購入導線+出典・プライバシー表記。
import { useState } from "react";
import { redeemPremiumCode } from "@fillmap/core/generic";

const STRIPE_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined;
const UNLOCK_HASH = import.meta.env.VITE_UNLOCK_CODE_HASH as string | undefined;

type Props = {
  premium: boolean;
  onPremiumUnlocked: () => void;
};

export function SettingsTab({ premium, onPremiumUnlocked }: Props) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleRedeem = async () => {
    setCodeError(null);
    if (!UNLOCK_HASH) {
      setCodeError("現在準備中です。");
      return;
    }
    const ok = await redeemPremiumCode("michimap.v1", code, UNLOCK_HASH);
    if (ok) {
      onPremiumUnlocked();
      setCode("");
    } else {
      setCodeError("コードが正しくありません。");
    }
  };

  return (
    <div className="absolute inset-0 top-[88px] overflow-y-auto pb-4">
      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {/* データ鮮度の注意(§A8/§A3 信頼設計) */}
        <section className="rounded-2xl bg-[#1e2530] p-3 text-xs text-[#fdba74]">
          道の駅の情報は変わる場合があります。最新は公式サイトでご確認ください(データ基準年: 2018年度)。
        </section>

        {/* 広告除外(買い切り) */}
        <section className="rounded-2xl bg-[#11151c] p-4">
          <h2 className="mb-1 text-sm font-semibold text-[#8b93a3]">広告除外</h2>
          {premium ? (
            <p className="rounded-lg bg-orange-400/10 p-3 text-sm text-orange-300">
              購入済みです。広告は表示されません。
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[#8b93a3]">
                買い切りで広告を非表示にできます。決済ページで購入後に表示されるコードをここに入力してください。
              </p>
              {STRIPE_LINK ? (
                <a
                  href={STRIPE_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-[#1e2530] py-3 text-center text-sm font-semibold text-[#e8ecf4] hover:bg-[#262d3a]"
                >
                  💳 広告を削除する(買い切り)
                </a>
              ) : (
                <p className="rounded-lg bg-[#1e2530] p-3 text-xs text-[#8b93a3]">準備中です。</p>
              )}
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="解除コードを入力"
                  className="flex-1 rounded-lg bg-[#1e2530] px-3 py-2 text-sm text-[#e8ecf4] outline-none"
                />
                <button
                  onClick={handleRedeem}
                  className="rounded-lg bg-orange-400 px-4 py-2 text-sm font-semibold text-[#0b0e14]"
                >
                  適用
                </button>
              </div>
              {codeError && <p className="text-xs text-red-400">{codeError}</p>}
            </div>
          )}
        </section>

        {/* 出典・プライバシー */}
        <section className="rounded-2xl bg-[#11151c] p-4 text-xs text-[#8b93a3]">
          <p className="mb-2 font-semibold text-[#e8ecf4]">このアプリについて</p>
          <p className="mb-3 rounded-lg bg-[#1e2530] px-3 py-2 text-[#e8ecf4]">
            訪問記録はすべて端末内にのみ保存されます。決済ページへの遷移を除き、外部サーバーへの送信は行いません。
          </p>
          <p className="font-semibold text-[#8b93a3]">出典</p>
          <ul className="mt-1 space-y-1">
            <li>
              道の駅データ(駅名・所在地・座標): 国土交通省 国土数値情報「道の駅」(P35-18, 2018年度版)をもとに作成。
            </li>
            <li>駅名・所在地・座標は事実データであり、施設情報・写真等は収載していません。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
