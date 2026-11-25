# EnvSentry

A lightweight, zero-dependency environment configuration validator for Node.js projects.

EnvSentry validates your `.env` file against `.env.example` to catch missing, empty, or duplicate environment variables before they cause runtime errors—without ever exposing sensitive secret values in terminal logs.

---

## Features

- **Zero Dependencies** — Built entirely with standard Node.js ES modules (`node:fs`, `node:path`, `node:test`).
- **Secret-Safe Reports** — Never prints sensitive values or credentials in terminal output or error messages.
- **Duplicate Key Detection** — Warns when a variable is defined multiple times in `.env`, including the exact line number.
- **Flexible `.env` Syntax** — Supports full-line comments (`#`), inline comments, single and double quotes, `=` characters inside values, and `export` prefixes.
- **CLI & Programmatic API** — Run `envsentry check` in your terminal / CI scripts or import `parseEnv` and `validateEnv` directly in Node.js applications.

---

## Installation

### Install in a Node.js Project

```bash
npm install envsentry-cli
```

Or install globally so the `envsentry` CLI command is available everywhere:

```bash
npm install -g envsentry-cli
```

Or run directly with `npx`:

```bash
npx envsentry-cli check
```

### Local Development / Linking

```bash
git clone https://github.com/the-prince-oss/EnvSentry.git
cd EnvSentry
npm link
```

> **Requirements:** Node.js `>=18.0.0`

---

## CLI Usage

Create a `.env.example` file listing your required environment variables and a `.env` file with your local configuration, then run:

```bash
envsentry check
```

View CLI help:

```bash
envsentry --help
```

### Example: Failing Validation Output (Exit Code `1`)

Given `.env.example`:
```dotenv
PORT=3000
DATABASE_URL="postgres://user:password@localhost:5432/college_app"
JWT_SECRET="your-jwt-secret-key"
API_KEY="your-third-party-api-key"
```

And `.env`:
```dotenv
PORT=4000
DATABASE_URL="postgres://admin:secret@localhost:5432/prod_db"
JWT_SECRET=
PORT=5000
```

Running `envsentry check` outputs:
```text
=== EnvSentry Configuration Report ===

  ✔ [VALID]   PORT
  ✔ [VALID]   DATABASE_URL
  ⚠ [EMPTY]   JWT_SECRET - Variable has an empty value
  ✖ [MISSING] API_KEY - Variable is missing

Duplicate Variables in .env:
  ⚠ [DUPLICATE] PORT (redefined on line 5)

Summary:
  Total Required : 4
  Valid          : 2
  Missing        : 1
  Empty          : 1
  Duplicates     : 1
  Total Issues   : 3

✖ Validation failed. Please fix the missing or empty variables above.
```

### Example: Passing Validation Output (Exit Code `0`)

When all required variables in `.env` are present and non-empty:
```text
=== EnvSentry Configuration Report ===

  ✔ [VALID]   PORT
  ✔ [VALID]   DATABASE_URL
  ✔ [VALID]   JWT_SECRET
  ✔ [VALID]   API_KEY

Summary:
  Total Required : 4
  Valid          : 4
  Missing        : 0
  Empty          : 0
  Duplicates     : 0
  Total Issues   : 0

✔ Environment configuration is valid!
```

---

## Programmatic API Usage

EnvSentry (`envsentry-cli`) exports `parseEnv` and `validateEnv` for use in your Node.js scripts:

```js
import fs from "node:fs";
import { parseEnv, validateEnv } from "envsentry-cli";

// 1. Parse .env content
const envContent = fs.readFileSync(".env", "utf8");
const { variables, duplicates } = parseEnv(envContent);

// 2. Validate against required variable names
const requiredVariables = ["PORT", "DATABASE_URL", "JWT_SECRET", "API_KEY"];
const report = validateEnv(variables, requiredVariables);

console.log(report.isValid); // true or false
console.log(report.summary);
// { total: 4, valid: 2, missing: 1, empty: 1 }

console.log(report.results);
// [
//   { key: 'PORT', status: 'valid', message: 'Variable is valid' },
//   { key: 'DATABASE_URL', status: 'valid', message: 'Variable is valid' },
//   { key: 'JWT_SECRET', status: 'empty', message: 'Variable has an empty value' },
//   { key: 'API_KEY', status: 'missing', message: 'Variable is missing' }
// ]
```

### API Reference

#### `parseEnv(content)`
- **`content`** (`string`): Raw `.env` file content. Throws a `TypeError` if not a string.
- **Returns**: `{ variables: Record<string, string>, duplicates: Array<{ key: string, line: number }> }`

#### `validateEnv(envVariables, requiredVariables)`
- **`envVariables`** (`Record<string, string>`): Key-value object of parsed environment variables.
- **`requiredVariables`** (`string[]`): Array of required variable names.
- **Returns**:
  - `isValid` (`boolean`): `true` when there are `0` missing and `0` empty variables.
  - `results` (`Array<{ key: string, status: "valid" | "missing" | "empty", message: string }>`).
  - `summary` (`{ total: number, valid: number, missing: number, empty: number }`).

---

## Running Tests

```bash
npm test
```

## License

[MIT](./LICENSE) © Prince Singh
