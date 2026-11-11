#!/bin/sh
# Opens three macOS dialogs (hidden input) and saves the Supabase TEST project keys to .env, which git ignores.
# Other lines in .env (TMDB, OMDb) are kept.
cd "$(dirname "$0")/.." || exit 1
ask() { osascript -e "text returned of (display dialog \"$1\" default answer \"\" with hidden answer with title \"Bingology\" buttons {\"ביטול\", \"שמירה\"} default button \"שמירה\" cancel button \"ביטול\")" 2>/dev/null; }
U=$(ask "פרויקט הבדיקות ב-Supabase: הדבק את ה-Project URL") || { echo "cancelled"; exit 1; }
A=$(ask "פרויקט הבדיקות: הדבק את ה-anon key") || { echo "cancelled"; exit 1; }
S=$(ask "פרויקט הבדיקות: הדבק את ה-service_role key") || { echo "cancelled"; exit 1; }
umask 077
touch .env
grep -v '^SUPABASE_TEST_' .env > .env.tmp || true
printf 'SUPABASE_TEST_URL=%s\nSUPABASE_TEST_ANON_KEY=%s\nSUPABASE_TEST_SERVICE_KEY=%s\n' "$U" "$A" "$S" >> .env.tmp
mv .env.tmp .env
echo "saved .env (URL ${#U} chars, anon ${#A} chars, service ${#S} chars)"
