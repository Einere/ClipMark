import { describe, expect, it } from "vitest";
import {
  formatVersionMismatch,
  normalizeReleaseVersion,
  updateReleaseVersionData,
} from "./release-version";

describe("release version helpers", () => {
  it("normalizes a plain semver version into version and tag values", () => {
    expect(normalizeReleaseVersion("1.2.3")).toEqual({
      tagName: "v1.2.3",
      version: "1.2.3",
    });
  });

  it("normalizes a v-prefixed semver tag", () => {
    expect(normalizeReleaseVersion("v1.2.3-beta.1+build.5")).toEqual({
      tagName: "v1.2.3-beta.1+build.5",
      version: "1.2.3-beta.1+build.5",
    });
  });

  it("rejects non-semver release versions", () => {
    expect(() => normalizeReleaseVersion("1.2")).toThrow("Release version");
    expect(() => normalizeReleaseVersion("release-1.2.3")).toThrow("Release version");
  });

  it("updates package, package-lock, and Tauri config versions", () => {
    const result = updateReleaseVersionData({
      version: "2.3.4",
      packageJson: { name: "clipmark", version: "0.1.0" },
      packageLockJson: {
        name: "clipmark",
        version: "0.1.0",
        packages: {
          "": { name: "clipmark", version: "0.1.0" },
          "node_modules/example": { version: "1.0.0" },
        },
      },
      tauriConfig: {
        productName: "ClipMark",
        version: "0.1.0",
      },
    });

    expect(result.packageJson.version).toBe("2.3.4");
    expect(result.packageLockJson.version).toBe("2.3.4");
    expect(result.packageLockJson.packages[""].version).toBe("2.3.4");
    expect(result.packageLockJson.packages["node_modules/example"].version).toBe("1.0.0");
    expect(result.tauriConfig.version).toBe("2.3.4");
  });

  it("formats version mismatches for CI errors", () => {
    expect(
      formatVersionMismatch({
        expectedVersion: "1.2.3",
        packageVersion: "1.2.3",
        lockVersion: "1.2.0",
        lockRootVersion: "1.2.3",
        tauriVersion: "1.2.0",
      }),
    ).toContain("package-lock.json version: 1.2.0");
  });
});
