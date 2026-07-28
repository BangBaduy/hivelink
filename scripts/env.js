"use strict";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required. Run this script with Node's --env-file=.env.local option.`
    );
  }
  return value;
}

module.exports = { requireEnv };
