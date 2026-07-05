import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const vercelConfigPath = path.resolve(process.cwd(), "vercel.json");

describe("production security policy", () => {
  it("allows only the WebAssembly capability Rive needs", () => {
    const config = JSON.parse(readFileSync(vercelConfigPath, "utf8"));
    const contentSecurityPolicy = config.headers
      .flatMap(({ headers }) => headers)
      .find(({ key }) => key === "Content-Security-Policy")?.value;
    const scriptSources = contentSecurityPolicy
      ?.split(";")
      .find((directive) => directive.trim().startsWith("script-src"))
      ?.trim()
      .split(/\s+/)
      .slice(1);

    expect(scriptSources).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(scriptSources).not.toContain("'unsafe-eval'");
  });
});
