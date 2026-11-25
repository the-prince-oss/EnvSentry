import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseEnv, validateEnv } from "../src/index.js";
import { runCli } from "../bin/envsentry.js";

describe("parseEnv", () => {
  it("parses valid key-value pairs", () => {
    const content = "PORT=3000\nNODE_ENV=development\nDB_HOST=localhost";
    const { variables, duplicates } = parseEnv(content);

    assert.deepEqual(variables, {
      PORT: "3000",
      NODE_ENV: "development",
      DB_HOST: "localhost"
    });
    assert.deepEqual(duplicates, []);
  });

  it("ignores full-line comments, inline unquoted comments, and blank lines", () => {
    const content = `
      # Database configuration
      DB_HOST=127.0.0.1 # local db host

      # Server port
      PORT=8080
      EMPTY_WITH_COMMENT= # should be empty
    `;
    const { variables, duplicates } = parseEnv(content);

    assert.deepEqual(variables, {
      DB_HOST: "127.0.0.1",
      PORT: "8080",
      EMPTY_WITH_COMMENT: ""
    });
    assert.deepEqual(duplicates, []);
  });

  it("strips surrounding double and single quotes and preserves # inside quotes", () => {
    const content = `
      APP_NAME="EnvSentry App"
      SECRET_KEY='my-secret#key'
      EMPTY_QUOTED=""
      SINGLE_QUOTE_CHAR="
    `;
    const { variables } = parseEnv(content);

    assert.deepEqual(variables, {
      APP_NAME: "EnvSentry App",
      SECRET_KEY: "my-secret#key",
      EMPTY_QUOTED: "",
      SINGLE_QUOTE_CHAR: '"'
    });
  });

  it("supports the optional export prefix", () => {
    const content = `
      export PORT=4000
      export API_URL="https://api.example.com"
    `;
    const { variables } = parseEnv(content);

    assert.deepEqual(variables, {
      PORT: "4000",
      API_URL: "https://api.example.com"
    });
  });

  it("detects duplicate keys and keeps the latest value", () => {
    const content = [
      "PORT=3000",
      "NODE_ENV=development",
      "PORT=5000"
    ].join("\n");

    const { variables, duplicates } = parseEnv(content);

    assert.equal(variables.PORT, "5000");
    assert.deepEqual(duplicates, [{ key: "PORT", line: 3 }]);
  });

  it("preserves '=' characters inside quoted and unquoted values", () => {
    const content = [
      'DATABASE_URL="postgres://user:pass@localhost:5432/db?sslmode=require"',
      "BASE64_TOKEN=YWJjZGVm=="
    ].join("\n");
    const { variables } = parseEnv(content);

    assert.equal(
      variables.DATABASE_URL,
      "postgres://user:pass@localhost:5432/db?sslmode=require"
    );
    assert.equal(variables.BASE64_TOKEN, "YWJjZGVm==");
  });

  it("ignores invalid environment variable names and lines without '='", () => {
    const content = [
      "123_INVALID=abc",
      "BAD-KEY=xyz",
      "NO_EQUALS_LINE",
      "=VALUE_WITHOUT_KEY",
      "_VALID_KEY_1=ok"
    ].join("\n");
    const { variables, duplicates } = parseEnv(content);

    assert.deepEqual(variables, {
      _VALID_KEY_1: "ok"
    });
    assert.deepEqual(duplicates, []);
  });

  it("handles Windows CRLF line endings properly", () => {
    const content = "PORT=3000\r\nHOST=localhost\r\n";
    const { variables } = parseEnv(content);

    assert.deepEqual(variables, {
      PORT: "3000",
      HOST: "localhost"
    });
  });

  it("throws a TypeError when content is not a string", () => {
    assert.throws(() => parseEnv(null), {
      name: "TypeError",
      message: /Expected content to be a string/
    });
    assert.throws(() => parseEnv(123), {
      name: "TypeError"
    });
  });
});

describe("validateEnv", () => {
  it("identifies valid, missing, and empty variables accurately", () => {
    const envVariables = {
      PORT: "3000",
      API_KEY: "   ",
      DB_URL: "mongodb://localhost:27017"
    };
    const requiredVariables = ["PORT", "API_KEY", "JWT_SECRET", "DB_URL"];

    const report = validateEnv(envVariables, requiredVariables);

    assert.equal(report.isValid, false);
    assert.deepEqual(report.summary, {
      total: 4,
      valid: 2,
      missing: 1,
      empty: 1
    });
    assert.deepEqual(report.results, [
      { key: "PORT", status: "valid", message: "Variable is valid" },
      { key: "API_KEY", status: "empty", message: "Variable has an empty value" },
      { key: "JWT_SECRET", status: "missing", message: "Variable is missing" },
      { key: "DB_URL", status: "valid", message: "Variable is valid" }
    ]);
  });

  it("returns isValid: true when all required variables are present and non-empty", () => {
    const envVariables = {
      PORT: "3000",
      NODE_ENV: "production"
    };
    const requiredVariables = ["PORT", "NODE_ENV"];

    const report = validateEnv(envVariables, requiredVariables);

    assert.equal(report.isValid, true);
    assert.deepEqual(report.summary, {
      total: 2,
      valid: 2,
      missing: 0,
      empty: 0
    });
  });

  it("deduplicates repeated keys in requiredVariables and ignores Object.prototype keys", () => {
    const envVariables = { PORT: "3000" };
    const report = validateEnv(envVariables, ["PORT", "PORT", "toString"]);

    assert.equal(report.isValid, false);
    assert.equal(report.summary.total, 2);
    assert.deepEqual(report.results, [
      { key: "PORT", status: "valid", message: "Variable is valid" },
      { key: "toString", status: "missing", message: "Variable is missing" }
    ]);
  });

  it("throws a TypeError for invalid inputs", () => {
    assert.throws(() => validateEnv(null, ["PORT"]), {
      name: "TypeError",
      message: /Expected envVariables to be a plain object/
    });

    assert.throws(() => validateEnv([], ["PORT"]), {
      name: "TypeError",
      message: /Expected envVariables to be a plain object/
    });

    assert.throws(() => validateEnv({}, "PORT"), {
      name: "TypeError",
      message: /Expected requiredVariables to be an array/
    });

    assert.throws(() => validateEnv({}, [""]), {
      name: "TypeError",
      message: /Each required variable name must be a non-empty string/
    });
  });
});

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "envsentry-test-"));
}

function createMockIo() {
  const logs = [];
  const errors = [];
  return {
    logs,
    errors,
    io: {
      log: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg)
    }
  };
}

describe("CLI (envsentry)", () => {
  it("displays help output with --help", () => {
    const { logs, io } = createMockIo();
    const exitCode = runCli(["--help"], process.cwd(), io);

    assert.equal(exitCode, 0);
    assert.match(logs.join("\n"), /Usage:/);
    assert.match(logs.join("\n"), /envsentry check/);
  });

  it("returns error for unknown commands", () => {
    const { errors, io } = createMockIo();
    const exitCode = runCli(["unknown"], process.cwd(), io);

    assert.equal(exitCode, 1);
    assert.match(errors.join("\n"), /Unknown command: "unknown"/);
  });

  it("shows helpful error if .env.example is missing", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\n");
      const { errors, io } = createMockIo();
      const exitCode = runCli(["check"], tempDir, io);

      assert.equal(exitCode, 1);
      assert.match(errors.join("\n"), /Missing \.env\.example file/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("shows helpful error if .env is missing", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, ".env.example"), "PORT=3000\n");
      const { errors, io } = createMockIo();
      const exitCode = runCli(["check"], tempDir, io);

      assert.equal(exitCode, 1);
      assert.match(errors.join("\n"), /Missing \.env file/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes check when all required variables are valid and never leaks secret values", () => {
    const tempDir = createTempDir();
    const superSecretValue = "SUPER_SECRET_TOKEN_VALUE_99999";
    try {
      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        "PORT=\nAPI_SECRET=\n"
      );
      fs.writeFileSync(
        path.join(tempDir, ".env"),
        `PORT=4000\nAPI_SECRET=${superSecretValue}\n`
      );

      const { logs, errors, io } = createMockIo();
      const exitCode = runCli(["check"], tempDir, io);
      const output = logs.join("\n");
      const errOutput = errors.join("\n");

      assert.equal(exitCode, 0);
      assert.equal(errors.length, 0);
      assert.match(output, /\[VALID\].*PORT/);
      assert.match(output, /\[VALID\].*API_SECRET/);
      assert.match(output, /Total Issues\s*:\s*0/);
      assert.match(output, /Environment configuration is valid!/);

      // Sensitive value must NEVER appear in stdout or stderr
      assert.equal(output.includes(superSecretValue), false);
      assert.equal(errOutput.includes(superSecretValue), false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports valid, missing, empty, and duplicate variables with exit code 1 and never leaks secrets", () => {
    const tempDir = createTempDir();
    const secretVal = "TOP_SECRET_PASSWORD_12345";
    try {
      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        "PORT=3000\nAPI_KEY=placeholder\nJWT_SECRET=placeholder\n"
      );
      fs.writeFileSync(
        path.join(tempDir, ".env"),
        `PORT=${secretVal}\nAPI_KEY=\nPORT=${secretVal}_2\n`
      );

      const { logs, errors, io } = createMockIo();
      const exitCode = runCli(["check"], tempDir, io);
      const output = logs.join("\n");
      const errOutput = errors.join("\n");

      assert.equal(exitCode, 1);
      assert.match(output, /\[VALID\].*PORT/);
      assert.match(output, /\[EMPTY\].*API_KEY/);
      assert.match(output, /\[MISSING\].*JWT_SECRET/);
      assert.match(output, /\[DUPLICATE\].*PORT.*line 3/);
      assert.match(output, /Total Issues\s*:\s*3/);
      assert.match( errOutput, /Validation failed/);

      assert.equal(output.includes(secretVal), false);
      assert.equal(errOutput.includes(secretVal), false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("can be executed directly as a CLI binary subprocess with proper exit codes", () => {
    const cliPath = path.resolve("bin/envsentry.js");
    const stdout = execFileSync(process.execPath, [cliPath, "--help"], {
      encoding: "utf8"
    });

    assert.match(stdout, /EnvSentry/);
    assert.match(stdout, /envsentry check/);

    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, ".env.example"), "PORT=3000\nMISSING_KEY=\n");
      fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\n");

      const failRun = spawnSync(process.execPath, [cliPath, "check"], {
        cwd: tempDir,
        encoding: "utf8"
      });
      assert.equal(failRun.status, 1);

      fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\nMISSING_KEY=present\n");
      const passRun = spawnSync(process.execPath, [cliPath, "check"], {
        cwd: tempDir,
        encoding: "utf8"
      });
      assert.equal(passRun.status, 0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
