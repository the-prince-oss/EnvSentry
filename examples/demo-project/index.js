import fs from "node:fs";
import { parseEnv, validateEnv } from "envsentry-cli";

const exampleEnv = parseEnv(fs.readFileSync(".env.example", "utf8"));
const currentEnv = parseEnv(fs.readFileSync(".env", "utf8"));

const requiredKeys = Object.keys(exampleEnv.variables);
const report = validateEnv(currentEnv.variables, requiredKeys);

console.log("Programmatic API Check:");
console.log("isValid:", report.isValid);
console.log("Summary:", report.summary);
console.log("Duplicates:", currentEnv.duplicates);
