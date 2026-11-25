export function parseEnv(content) {
  if (typeof content !== "string") {
    throw new TypeError("Expected content to be a string");
  }

  const variables = {};
  const duplicates = [];

  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Ignore empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    // Remove optional "export " prefix
    const cleanLine = trimmed.replace(/^export\s+/, "");

    const separatorIndex = cleanLine.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = cleanLine.slice(0, separatorIndex).trim();
    let value = cleanLine.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return;
    }

    // Remove surrounding quotes (ensure length >= 2 so a single quote isn't stripped)
    const isDoubleQuoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"');
    const isSingleQuoted = value.length >= 2 && value.startsWith("'") && value.endsWith("'");

    if (isDoubleQuoted || isSingleQuoted) {
      value = value.slice(1, -1);
    } else {
      // Strip inline comments on unquoted values (e.g. PORT=3000 # server port or KEY=#comment)
      const inlineCommentIndex = value.indexOf("#");
      if (inlineCommentIndex !== -1 && (inlineCommentIndex === 0 || /\s/.test(value[inlineCommentIndex - 1]))) {
        value = value.slice(0, inlineCommentIndex).trim();
      }
    }

    if (Object.hasOwn(variables, key)) {
      duplicates.push({
        key,
        line: index + 1
      });
    }

    variables[key] = value;
  });

  return { variables, duplicates };
}

