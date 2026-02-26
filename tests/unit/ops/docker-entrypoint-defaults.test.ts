import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(__dirname, "../../..");
const entrypointPath = path.join(repoRoot, "scripts/docker/entrypoint.sh");

const tempDirs: string[] = [];

function makeExecutable(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, {
    encoding: "utf8"
  });
  fs.chmodSync(filePath, 0o755);
}

describe("docker entrypoint defaults", () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, {
        recursive: true,
        force: true
      });
    }
    tempDirs.length = 0;
  });

  it("boots without DATABASE_URL by falling back to /app/data/app.db and auto-generates encryption key", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "entrypoint-defaults-"));
    tempDirs.push(workDir);

    const fakeBin = path.join(workDir, "fake-bin");
    fs.mkdirSync(fakeBin, {
      recursive: true
    });
    const traceFile = path.join(workDir, "trace.log");
    const keyFile = path.join(workDir, "settings.key");

    makeExecutable(
      path.join(fakeBin, "npx"),
      "#!/usr/bin/env bash\n" +
        "echo \"NPX ARGS=$*\" >> \"$TRACE_FILE\"\n" +
        "echo \"NPX DATABASE_URL=${DATABASE_URL:-}\" >> \"$TRACE_FILE\"\n" +
        "exit 0\n"
    );
    makeExecutable(
      path.join(fakeBin, "npm"),
      "#!/usr/bin/env bash\n" +
        "echo \"NPM ARGS=$*\" >> \"$TRACE_FILE\"\n" +
        "echo \"NPM DATABASE_URL=${DATABASE_URL:-}\" >> \"$TRACE_FILE\"\n" +
        "echo \"NPM APP_SETTINGS_ENCRYPTION_KEY=${APP_SETTINGS_ENCRYPTION_KEY:-}\" >> \"$TRACE_FILE\"\n" +
        "exit 0\n"
    );

    const env = {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      TRACE_FILE: traceFile,
      APP_SETTINGS_ENCRYPTION_KEY_FILE: keyFile,
      DATABASE_URL: "",
      APP_SETTINGS_ENCRYPTION_KEY: ""
    };

    const result = spawnSync("bash", [entrypointPath], {
      cwd: repoRoot,
      env,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(fs.existsSync(keyFile)).toBe(true);
    const keyValue = fs.readFileSync(keyFile, "utf8").trim();
    expect(keyValue.length).toBeGreaterThan(20);

    const trace = fs.readFileSync(traceFile, "utf8");
    expect(trace).toContain("NPX ARGS=prisma generate");
    expect(trace).toContain("NPX ARGS=prisma db push --skip-generate");
    expect(trace).toContain("NPM ARGS=run release:sanitize");
    expect(trace).toContain("NPM ARGS=run start");
    expect(trace).toContain("NPX DATABASE_URL=file:/app/data/app.db");
    expect(trace).toContain("NPM DATABASE_URL=file:/app/data/app.db");
    expect(trace).toMatch(/NPM APP_SETTINGS_ENCRYPTION_KEY=.+/);
  });
});
