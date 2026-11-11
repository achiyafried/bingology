#!/bin/sh
# Opens a macOS dialog (hidden input) and saves a Supabase personal access token to .env, which git ignores.
# Used only to apply supabase/schema.sql to the TEST project while building. Revoke the token when done.
cd "$(dirname "$0")/.." || exit 1
T=$(osascript -e "text returned of (display dialog \"הדבק את ה-Access Token מ-Supabase (מתחיל ב-sbp_)\" default answer \"\" with hidden answer with title \"Bingology\" buttons {\"ביטול\", \"שמירה\"} default button \"שמירה\" cancel button \"ביטול\")" 2>/dev/null) || { echo "cancelled"; exit 1; }
umask 077
touch .env
grep -v '^SUPABASE_ACCESS_TOKEN=' .env > .env.tmp || true
printf 'SUPABASE_ACCESS_TOKEN=%s\n' "$T" >> .env.tmp
mv .env.tmp .env
echo "saved .env (token ${#T} chars)"
