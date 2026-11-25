#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv, validateEnv } from "../src/index.js";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
};

function printHelp(log = console.log) {
  log(`
${COLORS.bold}${COLORS.cyan}EnvSentry${COLORS.reset} - Lightweight Environment Configuration Validator

${COLORS.bold}Usage:${COLORS.reset}
  envsentry check          Validate .env against .env.example in the current directory
  envsentry --help, -h     Show this help message
`);
}

function isReadableFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function runCli(args = process.argv.slice(2), cwd = process.cwd(), io = console) {
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || args.includes("--help") || args.includes("-h")) {
    printHelp(io.log);
    return 0;
  }

  if (command !== "check") {
    io.error(`${COLORS.red}✖ Unknown command: "${command}"${COLORS.reset}`);
    io.log(`Run ${COLORS.cyan}envsentry --help${COLORS.reset} to see available commands.`);
    return 1;
  }

  const envPath = path.join(cwd, ".env");
  const examplePath = path.join(cwd, ".env.example");

  if (!isReadableFile(examplePath)) {
    io.error(
      `${COLORS.red}✖ Error: Missing .env.example file in ${cwd}${COLORS.reset}\n` +
      `  Create a ${COLORS.cyan}.env.example${COLORS.reset} file listing your required environment variables.`
    );
    return 1;
  }

  if (!isReadableFile(envPath)) {
    io.error(
      `${COLORS.red}✖ Error: Missing .env file in ${cwd}${COLORS.reset}\n` +
      `  Create a ${COLORS.cyan}.env${COLORS.reset} file (for example, by copying ${COLORS.cyan}.env.example${COLORS.reset}).`
    );
    return 1;
  }

  let exampleContent;
  let envContent;
  try {
    exampleContent = fs.readFileSync(examplePath, "utf8");
    envContent = fs.readFileSync(envPath, "utf8");
  } catch (err) {
    io.error(`${COLORS.red}✖ Error reading environment files: ${err.message}${COLORS.reset}`);
    return 1;
  }

  const { variables: exampleVariables } = parseEnv(exampleContent);
  const requiredKeys = Object.keys(exampleVariables);

  const { variables: envVariables, duplicates } = parseEnv(envContent);
  const report = validateEnv(envVariables, requiredKeys);

  io.log(`\n${COLORS.bold}${COLORS.cyan}=== EnvSentry Configuration Report ===${COLORS.reset}\n`);

  if (requiredKeys.length === 0) {
    io.log(`${COLORS.yellow}⚠ No required variables found in .env.example.${COLORS.reset}`);
  } else {
    for (const item of report.results) {
      if (item.status === "valid") {
        io.log(`  ${COLORS.green}✔ [VALID]${COLORS.reset}   ${COLORS.bold}${item.key}${COLORS.reset}`);
      } else if (item.status === "missing") {
        io.log(`  ${COLORS.red}✖ [MISSING]${COLORS.reset} ${COLORS.bold}${item.key}${COLORS.reset} ${COLORS.dim}- ${item.message}${COLORS.reset}`);
      } else if (item.status === "empty") {
        io.log(`  ${COLORS.yellow}⚠ [EMPTY]${COLORS.reset}   ${COLORS.bold}${item.key}${COLORS.reset} ${COLORS.dim}- ${item.message}${COLORS.reset}`);
      }
    }
  }

  if (duplicates.length > 0) {
    io.log(`\n${COLORS.bold}${COLORS.yellow}Duplicate Variables in .env:${COLORS.reset}`);
    for (const dup of duplicates) {
      io.log(`  ${COLORS.yellow}⚠ [DUPLICATE]${COLORS.reset} ${COLORS.bold}${dup.key}${COLORS.reset} ${COLORS.dim}(redefined on line ${dup.line})${COLORS.reset}`);
    }
  }

  const totalIssues = report.summary.missing + report.summary.empty + duplicates.length;

  io.log(`\n${COLORS.bold}Summary:${COLORS.reset}`);
  io.log(`  Total Required : ${report.summary.total}`);
  io.log(`  ${COLORS.green}Valid          : ${report.summary.valid}${COLORS.reset}`);
  io.log(`  ${COLORS.red}Missing        : ${report.summary.missing}${COLORS.reset}`);
  io.log(`  ${COLORS.yellow}Empty          : ${report.summary.empty}${COLORS.reset}`);
  io.log(`  ${COLORS.yellow}Duplicates     : ${duplicates.length}${COLORS.reset}`);
  io.log(`  ${COLORS.bold}Total Issues   : ${totalIssues}${COLORS.reset}\n`);

  if (report.summary.missing > 0 || report.summary.empty > 0) {
    io.error(`${COLORS.red}${COLORS.bold}✖ Validation failed. Please fix the missing or empty variables above.${COLORS.reset}\n`);
    return 1;
  }

  if (duplicates.length > 0) {
    io.log(`${COLORS.yellow}${COLORS.bold}✔ Environment configuration is valid (with ${duplicates.length} duplicate warning(s)).${COLORS.reset}\n`);
    return 0;
  }

  io.log(`${COLORS.green}${COLORS.bold}✔ Environment configuration is valid!${COLORS.reset}\n`);
  return 0;
}

function isExecutedDirectly() {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  const exitCode = runCli();
  process.exitCode = exitCode;
}
