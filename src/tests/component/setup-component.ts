// Setup of the component tests only (vitest.component.config.ts).
//
// MUI X DataGrid (asset table, hazard table) debounces its row measurement
// (rowPositionsDebounceMs, 166 ms). A timer still pending when a test file
// ends fires after vitest has torn the jsdom environment down — React then
// throws "window is not defined" as an unhandled error, attributed to
// whichever file runs next (seen on the CI runner, 2026-10-30). A file that
// rendered a DataGrid therefore waits for such timers before its teardown;
// the others pay nothing. A MutationObserver notices the grid however the
// file's own cleanup hooks are ordered.
import { afterAll, beforeAll } from "vitest";

const GRID_TIMER_SETTLE_MS = 500;

let renderedDataGrid = false;
const observer = new MutationObserver(() => {
  if (!renderedDataGrid && document.querySelector(".MuiDataGrid-root")) renderedDataGrid = true;
});

beforeAll(() => {
  observer.observe(document.body, { childList: true, subtree: true });
});

afterAll(async () => {
  observer.disconnect();
  if (renderedDataGrid) await new Promise((resolve) => setTimeout(resolve, GRID_TIMER_SETTLE_MS));
});
