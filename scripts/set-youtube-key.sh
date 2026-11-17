#!/bin/sh
# Opens a macOS dialog (hidden input) and saves YOUTUBE_KEY to .env (git ignores it), keeping the other keys.
cd "$(dirname "$0")/.." || exit 1
K=$(osascript -e 'text returned of (display dialog "הדבק את מפתח ה-API של YouTube" default answer "" with hidden answer with title "Bingology" buttons {"ביטול", "שמירה"} default button "שמירה" cancel button "ביטול")' 2>/dev/null) || { echo "cancelled"; exit 1; }
umask 077
touch .env
grep -v '^YOUTUBE_KEY=' .env > .env.tmp; mv .env.tmp .env
printf 'YOUTUBE_KEY=%s\n' "$K" >> .env
echo "saved YOUTUBE_KEY (${#K} chars)"
