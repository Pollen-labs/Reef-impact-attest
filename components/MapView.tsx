"use client";

import { useEffect, useRef, useState } from "react";

type Feature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { uid: string | null };
};

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let maplib: any;
    let map: any;
    let destroyed = false;
    (async () => {
      const [{ default: maplibregl }] = await Promise.all([
        import("maplibre-gl"),
      ]);
      if (destroyed) return;

      // Inject MapLibre CSS via CDN to avoid bundling global CSS
      const linkId = "maplibre-css";
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";
        document.head.appendChild(link);
      }

      maplib = maplibregl;
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: "https://demotiles.maplibre.org/style.json",
        center: [0, 15],
        zoom: 1.6,
        attributionControl: true,
      });
      mapRef.current = map;

      map.addControl(new maplib.NavigationControl({ visualizePitch: true }));

      map.on("load", async () => {
        setReady(true);
        // Load data from API as GeoJSON FeatureCollection
        const res = await fetch("/api/attestations/public");
        const geojson = await res.json().catch(() => ({ type: "FeatureCollection", features: [] }));

        if (!geojson || !Array.isArray(geojson.features)) return;

        if (!map.getSource("attestations")) {
          map.addSource("attestations", { type: "geojson", data: geojson });
        }

        if (!map.getLayer("attestations-dots")) {
          map.addLayer({
            id: "attestations-dots",
            type: "circle",
            source: "attestations",
            paint: {
              "circle-radius": 5,
              "circle-color": "#0ea5e9",
              "circle-stroke-width": 1,
              "circle-stroke-color": "#fff",
            },
          });
        }

        map.on("click", "attestations-dots", (e: any) => {
          const f: Feature | undefined = e?.features?.[0];
          if (!f) return;
          const { uid } = f.properties as any;
          const orgName = (f.properties as any)?.orgName || "Unknown org";
          const handle = (f.properties as any)?.handle || null;
          const regenType = (f.properties as any)?.regenType || "";

          const html = document.createElement("div");
          html.style.minWidth = "220px";
          html.innerHTML = `
            <div style="display:grid;gap:6px">
              <div style="font-weight:600">${orgName}</div>
              ${regenType ? `<div>Type: ${regenType}</div>` : ""}
              ${handle ? `<a href="/profile/${handle}">View profile</a>` : ""}
              ${uid ? `<a target="_blank" rel="noreferrer" href="https://optimism-sepolia.easscan.org/attestation/view/${uid}">View on blockchain</a>` : ""}
            </div>
          `;
          new maplib.Popup({ closeOnMove: true })
            .setLngLat(e.lngLat)
            .setDOMContent(html)
            .addTo(map);
        });
        map.on("mouseenter", "attestations-dots", () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", "attestations-dots", () => map.getCanvas().style.cursor = "");
      });
    })();
    return () => {
      destroyed = true;
      try { mapRef.current?.remove(); } catch {}
    };
  }, []);

  return (
    <div style={{ height: "70vh", border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
