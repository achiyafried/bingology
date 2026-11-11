// Pre-merge check: `CHECK_PROD_CONFIG=1 npm test` fails while config.js still points at the TEST project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SUPABASE_URL } from "../site/lib/account/config.js";

test("site config points at the production project", { skip: !process.env.CHECK_PROD_CONFIG && "CHECK_PROD_CONFIG not set" }, () => {
  assert.ok(!SUPABASE_URL.includes("kdbcrtniiewfvngyqjdz"), "config.js still holds the TEST project's values");
});
