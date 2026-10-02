const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

type JsonRecord = Record<string, any>;

export interface NormalizedReleaseVersion {
  tagName: string;
  version: string;
}

export interface ReleaseVersionData {
  version: string;
  packageJson: JsonRecord;
  packageLockJson: JsonRecord;
  tauriConfig: JsonRecord;
}

export interface VersionMismatchInput {
  expectedVersion: string;
  packageVersion: string | undefined;
  lockVersion: string | undefined;
  lockRootVersion: string | undefined;
  tauriVersion: string | undefined;
}

export function normalizeReleaseVersion(input: string): NormalizedReleaseVersion {
  const trimmedInput = input.trim();
  const version = trimmedInput.startsWith("v") ? trimmedInput.slice(1) : trimmedInput;

  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(
      `Release version must look like 1.2.3, 1.2.3-beta.1, or 1.2.3+build.1. Received: ${input}`,
    );
  }

  return {
    tagName: `v${version}`,
    version,
  };
}

export function updateReleaseVersionData(data: ReleaseVersionData): ReleaseVersionData {
  const packageJson = structuredClone(data.packageJson);
  const packageLockJson = structuredClone(data.packageLockJson);
  const tauriConfig = structuredClone(data.tauriConfig);

  packageJson.version = data.version;
  packageLockJson.version = data.version;

  if (packageLockJson.packages?.[""]) {
    packageLockJson.packages[""].version = data.version;
  }

  tauriConfig.version = data.version;

  return {
    version: data.version,
    packageJson,
    packageLockJson,
    tauriConfig,
  };
}

export function formatVersionMismatch(input: VersionMismatchInput): string {
  return [
    `Release tag version: ${input.expectedVersion}`,
    `package.json version: ${input.packageVersion ?? "(missing)"}`,
    `package-lock.json version: ${input.lockVersion ?? "(missing)"}`,
    `package-lock.json packages[\"\"].version: ${input.lockRootVersion ?? "(missing)"}`,
    `src-tauri/tauri.conf.json version: ${input.tauriVersion ?? "(missing)"}`,
  ].join("\n");
}
