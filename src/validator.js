export function validateEnv(envVariables, requiredVariables) {
  if (
    typeof envVariables !== "object" ||
    envVariables === null ||
    Array.isArray(envVariables)
  ) {
    throw new TypeError("Expected envVariables to be a plain object");
  }

  if (!Array.isArray(requiredVariables)) {
    throw new TypeError("Expected requiredVariables to be an array");
  }

  const results = [];
  const seenKeys = new Set();

  for (const rawKey of requiredVariables) {
    if (typeof rawKey !== "string" || rawKey.trim() === "") {
      throw new TypeError("Each required variable name must be a non-empty string");
    }

    const key = rawKey.trim();
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    const hasKey = Object.hasOwn(envVariables, key);
    const value = hasKey ? envVariables[key] : undefined;

    if (!hasKey || value === undefined || value === null) {
      results.push({
        key,
        status: "missing",
        message: "Variable is missing"
      });
    } else if (String(value).trim() === "") {
      results.push({
        key,
        status: "empty",
        message: "Variable has an empty value"
      });
    } else {
      results.push({
        key,
        status: "valid",
        message: "Variable is valid"
      });
    }
  }

  const valid = results.filter((item) => item.status === "valid").length;
  const missing = results.filter((item) => item.status === "missing").length;
  const empty = results.filter((item) => item.status === "empty").length;

  return {
    isValid: missing === 0 && empty === 0,
    results,
    summary: {
      total: results.length,
      valid,
      missing,
      empty
    }
  };
}

