import { webFrame } from "electron";

console.log("=== PRELOAD LOADED ===");

// Disable pinch-to-zoom
webFrame.setVisualZoomLevelLimits(1, 1);

// Lock zoom level to 0 (100%)
webFrame.setZoomLevel(0);

console.log("Browser zoom disabled, draw.io can handle its own zoom");