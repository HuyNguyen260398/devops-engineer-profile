import { describe, it, expect } from "vitest";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import configFactory from "./next.config";

describe("next.config", () => {
  it("proxies /media/* to the backend in dev so uploaded images resolve", async () => {
    const dev = configFactory(PHASE_DEVELOPMENT_SERVER);
    expect(dev.output).toBeUndefined();
    expect(typeof dev.rewrites).toBe("function");
    const rewrites = await dev.rewrites!();
    const list = Array.isArray(rewrites) ? rewrites : [];
    const media = list.find((r) => r.source === "/media/:path*");
    expect(media).toBeDefined();
    expect(media!.destination).toMatch(/\/media\/:path\*$/);
  });

  it("uses static export and no rewrites for the production build", async () => {
    const prod = configFactory(PHASE_PRODUCTION_BUILD);
    expect(prod.output).toBe("export");
    expect(prod.rewrites).toBeUndefined();
  });
});
