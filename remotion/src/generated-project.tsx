import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Demo for manual site deployment. App exports write the saved video source
// into an isolated temporary directory instead of changing this file.
export default function ProjectMotionVideo({ theme }: { theme: unknown }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  void theme;
  return (
    <AbsoluteFill style={{ backgroundColor: "#111111", color: "#ffffff", justifyContent: "center", alignItems: "center", fontFamily: "Arial", gap: 24 }}>
      <div style={{ opacity, fontSize: 100, fontWeight: 800 }}>AI Vid</div>
      <div style={{ opacity, fontSize: 32, color: "#b8b8c0" }}>Remotion deployment demo</div>
    </AbsoluteFill>
  );
}
