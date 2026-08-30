#!/usr/bin/env bash
# clean.sh — wipe model-generated work, leaving each workspace at its seed state.
#
#   ./clean.sh                 # clean every workspace (prompts first)
#   ./clean.sh kimi3           # clean only the named workspace(s)
#   ./clean.sh --dry-run       # show what would go, delete nothing
#   ./clean.sh --yes           # skip the prompt
#   ./clean.sh --list          # list workspaces and exit
#
# Anything in a workspace that is not part of the seed is removed. The seed is
# listed in KEEP below — note that node_modules/ is kept deliberately: it is
# pre-installed, it is not in git, and there is no network to restore it.
set -euo pipefail
cd "$(dirname "$0")"

WORKSPACES=(claude-opus glm inkling kimi3)
KEEP=(BRIEF.md data)

DRY=0; YES=0; LIST=0; TARGETS=()

is_ws()   { local n="$1"; for w in "${WORKSPACES[@]}"; do [ "$w" = "$n" ] && return 0; done; return 1; }
is_keep() { local n="$1"; for k in "${KEEP[@]}";       do [ "$k" = "$n" ] && return 0; done; return 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --yes|-y)  YES=1 ;;
    --list)    LIST=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *)  if is_ws "$1"; then TARGETS+=("$1")
        else echo "unknown workspace: $1 (available: ${WORKSPACES[*]})" >&2; exit 2; fi ;;
  esac
  shift
done

if [ "$LIST" -eq 1 ]; then printf '%s\n' "${WORKSPACES[@]}"; exit 0; fi
[ "${#TARGETS[@]}" -eq 0 ] && TARGETS=("${WORKSPACES[@]}")

# ------------------------------------------------------------------ preview --
found=0
echo "==> clean.sh — remove model-generated work"
echo ""
echo "Seed kept in every workspace: ${KEEP[*]}"
echo ""
for p in "${TARGETS[@]}"; do
  if [ ! -d "$p" ]; then echo "  $p/ — not present, skipping"; continue; fi
  doomed=()
  while IFS= read -r entry; do
    is_keep "$entry" || doomed+=("$entry")
  done < <(ls -A1 "$p")
  if [ "${#doomed[@]}" -eq 0 ]; then
    echo "  $p/ — already clean"
  else
    echo "  $p/ — will remove: ${doomed[*]}"
    found=$((found + ${#doomed[@]}))
  fi
done
echo ""

if [ "$found" -eq 0 ]; then echo "Nothing to do — all workspaces are at seed state."; exit 0; fi
if [ "$DRY" -eq 1 ]; then echo "Dry run — nothing deleted."; exit 0; fi

if [ "$YES" -eq 0 ]; then
  read -r -p "Remove these $found item(s)? [y/N] " answer
  case "$answer" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 1 ;; esac
fi

# ------------------------------------------------------------------- delete --
for p in "${TARGETS[@]}"; do
  [ -d "$p" ] || continue
  while IFS= read -r entry; do
    is_keep "$entry" || rm -rf -- "${p:?}/${entry:?}"
  done < <(ls -A1 "$p")
done

echo ""
echo "Done. Workspaces are back to seed state."
for p in "${TARGETS[@]}"; do
  [ -d "$p" ] && echo "  $p/ — $(ls -A1 "$p" | tr '\n' ' ')"
done
