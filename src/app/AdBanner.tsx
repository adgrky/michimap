// Google AdSense バナー(画面下部・小)。premium(広告除外購入済)時は非表示。
// VITE_ADSENSE_CLIENT/VITE_ADSENSE_SLOT が未設定の間は何も描画しない(実運用ID未確定のため)。
import { useEffect } from "react";

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdBanner({ hidden }: { hidden: boolean }) {
  useEffect(() => {
    if (hidden || !CLIENT || !SLOT) return;
    if (!document.querySelector("script[data-adsbygoogle]")) {
      const script = document.createElement("script");
      script.async = true;
      script.dataset.adsbygoogle = "1";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      // 広告ブロッカー等は無視
    }
  }, [hidden]);

  if (hidden || !CLIENT || !SLOT) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center bg-[#0b0e14]" style={{ minHeight: 50 }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", maxWidth: 468, height: 50 }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="horizontal"
      />
    </div>
  );
}
