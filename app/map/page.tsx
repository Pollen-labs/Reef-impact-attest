import { MapView } from "@/components/MapView";

export default function Page() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1>Map</h1>
      <MapView />
    </div>
  );
}
