// 地図(POINT モード+クラスタリング, SPEC §E2/§A3)。外部タイル不要のブランクスタイル。
// 1,145駅と多いため maplibre のクラスタ機能を使用(500超 §E2)。
// 訪問済=テーマ色+グロー円、未訪問=グレー小円。訪問時にスタンプ演出(W1)。
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { CLUSTER, STAMP, THEME, UNVISITED } from "../domain/theme";

const SRC = "points";
const CLUSTERS = "clusters";
const GLOW = "points-glow";
const BASE = "points-base";
const STAMP_SRC = "stamp";
const STAMP_LYR = "points-stamp";

// 道の駅の分布(沖縄〜北海道)に合わせた初期 bbox
const JAPAN_BOUNDS: maplibregl.LngLatBoundsLike = [[126, 26], [146, 46]];

export type CaptureMapCallback = () => HTMLCanvasElement | null;

type Props = {
  onSelect: (id: string, name: string) => void;
  isVisited: (id: string) => boolean;
  onReady: (
    capture: CaptureMapCallback,
    applyVisit: (id: string, visited: boolean) => void,
    playStamp: (id: string) => void,
  ) => void;
};

const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b0e14" } }],
};

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function MapView({ onSelect, isVisited, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const coordsById = useRef<Map<string, [number, number]>>(new Map());
  const stampRaf = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BLANK_STYLE,
      center: [137, 37],
      zoom: 4,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    mapRef.current = map;

    map.on("load", async () => {
      map.addSource(SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "id",
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 44,
      });
      map.addSource(STAMP_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // クラスタ円(点数で大きさ可変)
      map.addLayer({
        id: CLUSTERS,
        type: "circle",
        source: SRC,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": CLUSTER,
          "circle-opacity": 0.9,
          "circle-stroke-color": "#0b0e14",
          "circle-stroke-width": 1,
          "circle-radius": ["step", ["get", "point_count"], 12, 20, 18, 100, 26],
        },
      });
      // グロー層(訪問済の個別駅のみ点灯)
      map.addLayer({
        id: GLOW,
        type: "circle",
        source: SRC,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": THEME,
          "circle-blur": 1,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 8, 12, 18],
          "circle-opacity": ["case", ["boolean", ["feature-state", "visited"], false], 0.5, 0],
        },
      });
      // 個別駅の円
      map.addLayer({
        id: BASE,
        type: "circle",
        source: SRC,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["case", ["boolean", ["feature-state", "visited"], false], THEME, UNVISITED],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["case", ["boolean", ["feature-state", "visited"], false], 4, 3],
            12,
            ["case", ["boolean", ["feature-state", "visited"], false], 9, 6],
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "visited"], false], 1.5, 0],
        },
      });
      // スタンプ演出(訪問時に判子が落ちる)
      map.addLayer({
        id: STAMP_LYR,
        type: "circle",
        source: STAMP_SRC,
        paint: {
          "circle-color": STAMP,
          "circle-opacity": 0,
          "circle-radius": 8,
        },
      });

      // クラスタクリック→ズームイン展開
      map.on("click", CLUSTERS, (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: [CLUSTERS] })[0];
        const clusterId = f?.properties?.cluster_id;
        if (clusterId == null) return;
        const src = map.getSource(SRC) as maplibregl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
      });

      const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.id ?? f.properties?.id);
        onSelect(id, f.properties?.name ?? id);
      };
      map.on("click", BASE, handleClick);
      map.on("click", GLOW, handleClick);
      map.on("mouseenter", CLUSTERS, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", CLUSTERS, () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", BASE, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", BASE, () => (map.getCanvas().style.cursor = ""));

      const capture: CaptureMapCallback = () => map.getCanvas();
      const applyVisit = (id: string, visited: boolean) =>
        map.setFeatureState({ source: SRC, id }, { visited });
      const playStamp = (id: string) => {
        const c = coordsById.current.get(id);
        if (!c || prefersReducedMotion) return;
        const ssrc = map.getSource(STAMP_SRC) as maplibregl.GeoJSONSource;
        ssrc.setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }],
        });
        const start = performance.now();
        const DUR = 380;
        const tick = (now: number) => {
          const t = Math.min((now - start) / DUR, 1);
          // 判子が上から落ちて押される: 大→小へ縮みつつ濃く→消える
          map.setPaintProperty(STAMP_LYR, "circle-radius", 8 + (1 - t) * 24);
          map.setPaintProperty(STAMP_LYR, "circle-opacity", t < 0.5 ? t * 1.6 : 0.8 * (1 - t) * 2);
          if (t < 1) {
            stampRaf.current = requestAnimationFrame(tick);
          } else {
            ssrc.setData({ type: "FeatureCollection", features: [] });
          }
        };
        cancelAnimationFrame(stampRaf.current);
        stampRaf.current = requestAnimationFrame(tick);
      };
      onReady(capture, applyVisit, playStamp);

      map.fitBounds(JAPAN_BOUNDS, { padding: 30, duration: 0 });

      try {
        const res = await fetch("./data/points.geojson");
        const fc = await res.json();
        (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(fc);
        for (const f of fc.features) {
          const id = f.properties?.id ?? f.id;
          const coords = f.geometry?.coordinates;
          if (id && Array.isArray(coords)) coordsById.current.set(String(id), [coords[0], coords[1]]);
          if (id && isVisited(String(id))) map.setFeatureState({ source: SRC, id }, { visited: true });
        }
      } catch {
        // 取得失敗時は空のまま
      }
    });

    return () => {
      cancelAnimationFrame(stampRaf.current);
      map.remove();
      mapRef.current = null;
      coordsById.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
