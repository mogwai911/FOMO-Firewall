"use strict";

function resolveE2EDatabaseUrl(env = process.env) {
  const override = env.E2E_DATABASE_URL;
  if (typeof override === "string" && override.trim()) {
    return override.trim();
  }
  return "file:./e2e.db";
}

module.exports = {
  resolveE2EDatabaseUrl
};
