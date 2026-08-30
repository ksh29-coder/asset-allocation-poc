#!/usr/bin/env bash
# preinstall.sh — provision each workspace so the advisor-tool build starts warm.
#
# Writes package.json, tsconfig.json and .gitignore into every workspace, then
# installs that workspace's own node_modules. Each workspace is fully isolated:
# it carries its own copy of data/, nothing is shared between them, and nothing
# is installed at this folder or at the repo root above it.
#
# Behavior:
#   ./preinstall.sh              # provision ALL workspaces, then verify
#   ./preinstall.sh kimi3        # provision only the named workspace(s)
#   ./preinstall.sh --check      # verify only, change nothing (nonzero if not ready)
#   ./preinstall.sh --list       # show workspace names and port ranges, then exit
#
# Run this once, before the session starts. It is idempotent.
set -euo pipefail
cd "$(dirname "$0")"

ALL_PROJECTS=(claude-opus kimi3 inkling glm)

# Pinned so every workspace builds against an identical toolchain.
ESBUILD_V="^0.28.2"
TYPESCRIPT_V="^7.0.2"
TYPES_NODE_V="^26.4.0"
UPLOT_V="^1.6.32"

MIN_NODE_MAJOR=23   # native .ts execution (type stripping on by default since 23.6)

CHECK_ONLY=0
LIST_ONLY=0
TARGETS=()
FAILURES=0
WARNINGS=0

usage() { sed -n '2,16p' "$0"; }

port_base() {
  case "$1" in
    claude-opus) echo 7600 ;;
    kimi3)       echo 7700 ;;
    inkling)     echo 7800 ;;
    glm)         echo 7900 ;;
    *)           echo "" ;;
  esac
}

contains() {
  local needle="$1"; shift
  for x in "$@"; do [ "$x" = "$needle" ] && return 0; done
  return 1
}

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }

while [ $# -gt 0 ]; do
  case "$1" in
    --check)   CHECK_ONLY=1 ;;
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
        echo "unknown workspace: $1 (available: ${ALL_PROJECTS[*]})" >&2
        exit 2
      fi
      ;;
  esac
  shift
done

if [ "$LIST_ONLY" -eq 1 ]; then
  for p in "${ALL_PROJECTS[@]}"; do
    b="$(port_base "$p")"
    printf '%-12s %s-%s\n' "$p" "$b" "$((b + 9))"
  done
  exit 0
fi

[ "${#TARGETS[@]}" -eq 0 ] && TARGETS=("${ALL_PROJECTS[@]}")

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

echo "==> preinstall.sh — provision workspaces for the advisor-tool brief"
echo ""

# ---------------------------------------------------------------- preflight --
echo "Toolchain"

if ! command -v node >/dev/null 2>&1; then
  bad "node is not on PATH"
elif ! command -v npm >/dev/null 2>&1; then
  bad "npm is not on PATH"
else
  NODE_V="$(node -v)"
  NODE_MAJOR="$(echo "${NODE_V#v}" | cut -d. -f1)"
  if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
    bad "node $NODE_V is too old — need >= v$MIN_NODE_MAJOR to run .ts files directly"
  else
    ok "node $NODE_V, npm $(npm -v)"
  fi
fi

if [ "$FAILURES" -gt 0 ]; then
  echo ""
  echo "Preflight failed — nothing was installed."
  exit 1
fi

# The brief promises these two things work. Verify rather than assume.
printf 'const answer: number = 42;\nif (answer !== 42) process.exit(1);\n' > "$SCRATCH/strip.ts"
if node "$SCRATCH/strip.ts" >/dev/null 2>&1; then
  ok "node executes .ts directly (type stripping)"
else
  bad "node cannot execute a .ts file — the brief's stack does not work here"
fi

printf 'import test from "node:test";\nimport assert from "node:assert";\ntest("smoke", () => assert.equal(1, 1));\n' > "$SCRATCH/smoke.test.ts"
if node --test "$SCRATCH/smoke.test.ts" >/dev/null 2>&1; then
  ok "node --test runs .ts test files"
else
  bad "node --test cannot run a .ts test file"
fi

# ------------------------------------------------------------ isolation guard --
# Node resolves node_modules by walking UP the tree. Anything installed at the
# repo root would leak into every workspace and break their independence.
LEAK=""
for anc in "." ".."; do
  if [ -e "$anc/package.json" ] || [ -e "$anc/node_modules" ]; then
    LEAK="$LEAK $(cd "$anc" && pwd)"
  fi
done
if [ -n "$LEAK" ]; then
  bad "package.json or node_modules/ found above the workspaces, in:$LEAK"
  echo "    Node resolves modules by walking up, so that leaks into every"
  echo "    workspace. Remove it and re-run."
  echo ""
  echo "Aborted — workspaces must stay independent."
  exit 1
fi
ok "no shared package.json or node_modules/ in any ancestor directory"
echo ""

# --------------------------------------------------------------- workspaces --
write_configs() {
  local dir="$1"

  cat > "$dir/package.json" <<JSON
{
  "name": "portfolio-builder-$dir",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "devDependencies": {
    "@types/node": "$TYPES_NODE_V",
    "esbuild": "$ESBUILD_V",
    "typescript": "$TYPESCRIPT_V",
    "uplot": "$UPLOT_V"
  }
}
JSON

  # erasableSyntaxOnly mirrors Node's type-stripping limits, so `tsc --noEmit`
  # reports enum/namespace/parameter-properties as type errors instead of
  # letting them explode at runtime.
  cat > "$dir/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
JSON

  if ! grep -qs '^node_modules/$' "$dir/.gitignore" 2>/dev/null; then
    printf 'node_modules/\n' >> "$dir/.gitignore"
  fi
}

install_deps() {
  local dir="$1"
  if [ -d "$dir/node_modules" ] && (cd "$dir" && npm ls --depth=0 >/dev/null 2>&1); then
    echo "  … dependencies already satisfied, skipping install"
    return 0
  fi
  if [ -f "$dir/package-lock.json" ]; then
    echo "  … npm ci"
    (cd "$dir" && npm ci --no-audit --no-fund --loglevel=error)
  else
    echo "  … npm install"
    (cd "$dir" && npm install --no-audit --no-fund --loglevel=error)
  fi
}

verify_workspace() {
  local dir="$1" base f
  base="$(port_base "$dir")"

  for f in BRIEF.md data/products.csv data/prices.csv data/client_portfolio.csv data/DATA_NOTES.md; do
    [ -f "$dir/$f" ] || bad "$dir: missing $f"
  done

  [ -f "$dir/package.json" ]  || bad "$dir: missing package.json"
  [ -f "$dir/tsconfig.json" ] || bad "$dir: missing tsconfig.json"
  grep -qs 'erasableSyntaxOnly' "$dir/tsconfig.json" || bad "$dir: tsconfig.json lacks erasableSyntaxOnly"

  # Each tool must resolve from INSIDE this workspace, not from a parent.
  if (cd "$dir" && npx --no-install esbuild --version >/dev/null 2>&1); then
    ok "$dir: esbuild $( cd "$dir" && npx --no-install esbuild --version )"
  else
    bad "$dir: esbuild does not resolve from this workspace"
  fi

  if (cd "$dir" && npx --no-install tsc --version >/dev/null 2>&1); then
    ok "$dir: $( cd "$dir" && npx --no-install tsc --version )"
  else
    bad "$dir: tsc does not resolve from this workspace"
  fi

  if [ -f "$dir/node_modules/@types/node/package.json" ]; then
    ok "$dir: @types/node present"
  else
    bad "$dir: @types/node missing — node: imports will not type-check"
  fi

  if [ -f "$dir/node_modules/uplot/package.json" ]; then
    ok "$dir: uplot present"
  else
    bad "$dir: uplot missing"
  fi

  # Prove erasableSyntaxOnly actually bites, using THIS workspace's compiler.
  printf 'enum Bad { A = 1 }\nexport default Bad;\n' > "$SCRATCH/enum.ts"
  if (cd "$dir" && npx --no-install tsc --noEmit --strict --erasableSyntaxOnly "$SCRATCH/enum.ts" >/dev/null 2>&1); then
    bad "$dir: tsc accepted an enum — erasableSyntaxOnly is not enforced"
  else
    ok "$dir: tsc rejects enum (matches Node's type-stripping limits)"
  fi

  if [ -n "$base" ]; then
    local p busy=""
    for p in $(seq "$base" $((base + 9))); do
      if nc -z 127.0.0.1 "$p" >/dev/null 2>&1; then busy="$busy $p"; fi
    done
    if [ -n "$busy" ]; then
      warn "$dir: ports already listening:$busy (range $base-$((base + 9)))"
    else
      ok "$dir: ports $base-$((base + 9)) free"
    fi
  fi
}

for p in "${TARGETS[@]}"; do
  echo "Workspace $p/  (ports $(port_base "$p")-$(( $(port_base "$p") + 9 )))"
  if [ ! -d "$p" ]; then
    bad "$p: directory not present"
    echo ""
    continue
  fi
  if [ "$CHECK_ONLY" -eq 0 ]; then
    write_configs "$p"
    install_deps "$p"
  fi
  verify_workspace "$p"
  echo ""
done

# ------------------------------------------------------------------ report --
echo "-------------------------------------------------------------"
if [ "$FAILURES" -eq 0 ]; then
  if [ "$CHECK_ONLY" -eq 1 ]; then
    echo "Ready — ${#TARGETS[@]}/${#TARGETS[@]} workspaces provisioned (checked, nothing changed)."
  else
    echo "Ready — ${#TARGETS[@]}/${#TARGETS[@]} workspaces provisioned."
  fi
  [ "$WARNINGS" -gt 0 ] && echo "($WARNINGS warning(s) above — not fatal.)"
  exit 0
else
  echo "Not ready — $FAILURES check(s) failed."
  exit 1
fi
