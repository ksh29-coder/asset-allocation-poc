#!/usr/bin/env bash
# clean.sh — remove model-generated code, leaving only the seed files
# (README.md, BRIEF.md, data/) in each selected project subdirectory.
#
# Behavior:
#   ./clean.sh                  # clean ALL model projects (interactive prompt)
#   ./clean.sh kimi3            # clean only the named project(s)
#   ./clean.sh kimi3 inkling    # multiple projects allowed
#   ./clean.sh --yes            # skip prompt
#   ./clean.sh --dry-run        # preview, delete nothing
#   ./clean.sh --list           # show available project names and exit
#
# Strategy: wipe the project directory entirely, then restore what git HEAD
# tracks. Anything committed survives; everything else (source, tests, venvs,
# caches, local state) is deleted. Passing one or more project names limits
# the cleanup to those.
set -euo pipefail
cd "$(dirname "$0")"

ALL_PROJECTS=(claude-opus inkling kimi3)

DRY_RUN=0
ASSUME_YES=0
LIST_ONLY=0
TARGETS=()

usage() {
  sed -n '2,14p' "$0"
}

contains() {
  local needle="$1"; shift
  for x in "$@"; do [ "$x" = "$needle" ] && return 0; done
  return 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y)  ASSUME_YES=1 ;;
    --list)    LIST_ONLY=1 ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    -*)
      echo "unknown flag: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if contains "$1" "${ALL_PROJECTS[@]}"; then
        TARGETS+=("$1")
      else
        echo "unknown project: $1 (available: ${ALL_PROJECTS[*]})" >&2
        exit 2
      fi
      ;;
  esac
  shift
done

if [ "$LIST_ONLY" -eq 1 ]; then
  printf '%s\n' "${ALL_PROJECTS[@]}"
  exit 0
fi

# Default: all projects.
if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=("${ALL_PROJECTS[@]}")
fi

preview() {
  for p in "${TARGETS[@]}"; do
    if [ ! -d "$p" ]; then
      echo "--- $p/ (not present, will be skipped) ---"
      echo ""
      continue
    fi
    echo "--- $p/ (current contents) ---"
    find "$p" -mindepth 1 -maxdepth 1 | sort | sed "s|^$p/|  |"
    echo ""
  done
  echo "Seed files that survive (restored from git HEAD):"
  for p in "${TARGETS[@]}"; do
    git ls-tree -r HEAD --name-only -- "$p" | sed 's/^/  /'
  done
  # Root README.md is never touched; only mention it when wiping everything.
  if [ "${#TARGETS[@]}" -eq "${#ALL_PROJECTS[@]}" ]; then
    git ls-tree -r HEAD --name-only | grep -v '^claude-opus/\|^inkling/\|^kimi3/' | sed 's/^/  /' || true
  fi
  echo ""
}

echo "==> clean.sh — wipe model-generated code"
echo ""
preview

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run — nothing deleted."
  exit 0
fi

if [ "$ASSUME_YES" -eq 0 ]; then
  read -r -p "Proceed with deletion? [y/N] " answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

for p in "${TARGETS[@]}"; do
  if [ ! -d "$p" ]; then
    echo "Skipping $p/ (not present)"
    continue
  fi
  echo "Cleaning $p/"
  rm -rf -- "$p"
  git checkout HEAD -- "$p"
done

echo "Done."
echo ""
echo "Verification:"
git status --short
