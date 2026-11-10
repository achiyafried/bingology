#!/bin/sh
# Opens two macOS dialogs (hidden input) and saves the keys to .env, which git ignores.
cd "$(dirname "$0")/.." || exit 1
ask() { osascript -e "text returned of (display dialog \"$1\" default answer \"\" with hidden answer with title \"Bingology\" buttons {\"ביטול\", \"שמירה\"} default button \"שמירה\" cancel button \"ביטול\")" 2>/dev/null; }
T=$(ask "הדבק את ה-API Read Access Token מ-TMDB") || { echo "cancelled"; exit 1; }
O=$(ask "הדבק את המפתח של OMDb") || { echo "cancelled"; exit 1; }
umask 077
printf 'TMDB_TOKEN=%s\nOMDB_KEY=%s\n' "$T" "$O" > .env
echo "saved .env (TMDB ${#T} chars, OMDb ${#O} chars)"
