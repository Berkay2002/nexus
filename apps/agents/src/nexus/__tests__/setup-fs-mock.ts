/**
 * Vitest setup file: makes the native `fs` module configurable so that
 * `vi.spyOn(fs, "readdirSync")` works in ESM mode.
 *
 * This re-exports all real implementations so no fs behaviour changes —
 * the only effect is that the module's exports become spy-interceptable.
 */
import { vi } from "vitest";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return { ...actual, default: actual };
});
