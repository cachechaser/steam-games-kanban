#!/bin/bash

# ============================================================
# Searches for local Steam collection data in
# cloud-storage-namespace-1.json and outputs clean JSON

# Usage:
#   ./extract_collections.sh                        # all collections
#   ./extract_collections.sh "SEARCH_TERM"          # filter by name
#   ./extract_collections.sh > collections.json     # save to file
#
# Output format:
# {
#   "collections": [
#     { "name": "Playing", "game_ids": [12345, 67890] },
#     ...
#   ]
# }
#
# Then paste/upload the output in/to the web app
# ============================================================

set -u

SEARCH_TERM="${1:-}"

# --- Detect OS and set search paths ---
STEAM_BASES=()

case "$(uname -s)" in
    Linux*)
        STEAM_BASES=(
            "$HOME/.steam/steam/userdata"
            "$HOME/.local/share/Steam/userdata"
            "$HOME/snap/steam/common/.steam/steam/userdata"
            "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam/userdata"
        )
        ;;
    Darwin*)
        STEAM_BASES=(
            "$HOME/Library/Application Support/Steam/userdata"
        )
        ;;
    CYGWIN*|MINGW*|MSYS*)
        STEAM_BASES=(
            "C:/Program Files (x86)/Steam/userdata"
            "C:/Program Files/Steam/userdata"
        )
        for DRIVE in D E F; do
            [ -d "${DRIVE}:/Steam/userdata" ] && STEAM_BASES+=("${DRIVE}:/Steam/userdata")
            [ -d "${DRIVE}:/SteamLibrary/userdata" ] && STEAM_BASES+=("${DRIVE}:/SteamLibrary/userdata")
        done
        ;;
    *)
        echo "[ERROR] Unsupported OS: $(uname -s)" >&2
        exit 1
        ;;
esac

JSON_FILES=()

for BASE in "${STEAM_BASES[@]}"; do
    [ -d "$BASE" ] || continue
    while IFS= read -r -d '' file; do
        JSON_FILES+=("$file")
    done < <(find "$BASE" -type f -name "cloud-storage-namespace-1.json" -print0 2>/dev/null)
done

if [ ${#JSON_FILES[@]} -eq 0 ]; then
    echo "[ERROR] Could not find any cloud-storage-namespace-1.json files." >&2
    echo "[INFO]  Make sure Steam is installed and you have logged in at least once." >&2
    echo "[INFO]  Searched paths:" >&2
    for p in "${STEAM_BASES[@]}"; do echo "         - $p" >&2; done
    exit 1
fi

echo "[INFO] Found ${#JSON_FILES[@]} userdata file(s):" >&2
for f in "${JSON_FILES[@]}"; do echo "  -> $f" >&2; done

# --- Extract collections into a temp file (one JSON object per line) ---
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

# ---------------------------------------------------------------------------
# _parse_file <json_file>
# Outputs one {"name":"...","game_ids":[...]} per line.
# ---------------------------------------------------------------------------
_parse_file() {
    local json_file="$1"
    { grep -oE '"value":"([^"\\]|\\.)*"' "$json_file" 2>/dev/null || true; } \
    | sed 's/^"value":"//; s/"$//' \
    | sed 's/\\"/`/g' \
    | awk -v search="$SEARCH_TERM" '
    {
        n = $0
        if (match(n, /`name`:`[^`]*`/)) {
            name = substr(n, RSTART+8, RLENGTH-9)
        } else next
        if (length(name) == 0) next
        if (search != "" && index(tolower(name), tolower(search)) == 0) next
        if (match(n, /`added`:\[[0-9, ]*\]/)) {
            added = substr(n, RSTART+9, RLENGTH-10)
            ids = "[" added "]"
        } else {
            ids = "[]"
        }
        gsub(/`/, "\"", name)
        printf "{\"name\":\"%s\",\"game_ids\":%s}\n", name, ids
    }'
}

for JSON_FILE in "${JSON_FILES[@]}"; do
    echo "[INFO] Parsing: $JSON_FILE" >&2
    _parse_file "$JSON_FILE" >> "$TMPFILE"
done

# --- deduplicate by collection name (last occurrence = most recent Steam user) ---
if command -v awk &>/dev/null; then
    DEDUPED=$(mktemp)
    awk -F'"name":"' 'NF>1 {split($2,a,"\""); name=a[1]; data[name]=$0} END{for(n in data) print data[n]}' \
        "$TMPFILE" > "$DEDUPED"
    mv "$DEDUPED" "$TMPFILE"
fi

# filter by SEARCH_TERM if provided (case-insensitive substring match on collection name)
if [ -n "$SEARCH_TERM" ]; then
    FILTERED=$(mktemp)
    { grep -i "\"name\":\"[^\"]*${SEARCH_TERM}[^\"]*\"" "$TMPFILE" > "$FILTERED" 2>/dev/null || true; }
    mv "$FILTERED" "$TMPFILE"
fi

# --- final JSON ---
TOTAL=$(wc -l < "$TMPFILE" | tr -d ' ')
echo "[INFO] Found $TOTAL collection(s)." >&2

FINAL_JSON=$(
    echo '{"collections":['
    COUNT=0
    while IFS= read -r entry; do
        COUNT=$((COUNT + 1))
        if [ "$COUNT" -lt "$TOTAL" ]; then
            echo "  ${entry},"
        else
            echo "  ${entry}"
        fi
    done < "$TMPFILE"
    echo ']}'
)

echo "$FINAL_JSON"

# --- clipboard ---
CLIP_DONE=0
if command -v pbcopy &>/dev/null; then
    printf '%s' "$FINAL_JSON" | pbcopy && CLIP_DONE=1
elif command -v xclip &>/dev/null; then
    printf '%s' "$FINAL_JSON" | xclip -selection clipboard && CLIP_DONE=1
elif command -v xsel &>/dev/null; then
    printf '%s' "$FINAL_JSON" | xsel --clipboard --input && CLIP_DONE=1
elif command -v clip.exe &>/dev/null; then
    printf '%s' "$FINAL_JSON" | clip.exe && CLIP_DONE=1
fi

echo "" >&2
if [ "$CLIP_DONE" -eq 1 ]; then
    echo "[DONE] JSON copied to clipboard. Paste it in the web app under" >&2
    echo "       Profile Edit -> Import Steam Collections." >&2
else
    echo "[DONE] Copy the JSON output above and paste it into the web app" >&2
    echo "       under Profile Edit -> Import Steam Collections." >&2
fi
