#!/usr/bin/env bash
#
# Scaffolds a new admin panel from the skill's frontend template.
#
#   create-panel.sh --dest ~/work/acme-admin --name "Acme" --hue 160 \
#                   --api http://localhost:4000 [--install]
#
# Produces a complete, typechecking Next.js panel: auth with token refresh,
# app shell, dashboard, and one worked entity page to clone. Adapt the
# envelope in src/types/index.ts first: everything else depends on it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../assets/frontend"

DEST=""
NAME="Admin Panel"
HUE=""
API="http://localhost:4000"
INSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest)    DEST="$2"; shift 2 ;;
    --name)    NAME="$2"; shift 2 ;;
    --hue)     HUE="$2"; shift 2 ;;
    --api)     API="$2"; shift 2 ;;
    --install) INSTALL=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$DEST" ]] || { echo "--dest is required" >&2; exit 1; }
[[ -d "$TEMPLATE" ]] || { echo "Template missing at $TEMPLATE" >&2; exit 1; }

if [[ -e "$DEST" && -n "$(ls -A "$DEST" 2>/dev/null)" ]]; then
  echo "Refusing to scaffold into non-empty directory: $DEST" >&2
  exit 1
fi

mkdir -p "$DEST"
# `/.` copies dotfiles too (.env.example).
cp -R "$TEMPLATE/." "$DEST/"
mv "$DEST/_gitignore" "$DEST/.gitignore"
cp "$DEST/.env.example" "$DEST/.env.local"

# Lowercase, hyphenated slug for package name and storage key.
SLUG="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' \
        | sed -e 's/^-*//' -e 's/-*$//')"
[[ -n "$SLUG" ]] || SLUG="admin"

python3 - "$DEST" "$NAME" "$SLUG" "$HUE" "$API" <<'PY'
import json, pathlib, re, sys

dest, name, slug, hue, api = sys.argv[1:6]
root = pathlib.Path(dest)

# package.json name
pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
pkg['name'] = f'{slug}-admin'
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

# branding
b = root / 'src/lib/branding.ts'
s = b.read_text()
s = s.replace("name: 'Admin Panel',", f"name: '{name} Admin',")
s = s.replace("description: 'Administration panel',",
              f"description: 'Administration panel for {name}',")
b.write_text(s)

# per-panel localStorage key, so two panels in one browser cannot collide
a = root / 'src/lib/auth-store.ts'
s = a.read_text().replace("name: 'admin-panel-auth',", f"name: '{slug}-admin-auth',")
a.write_text(s)

# API origin
e = root / '.env.local'
e.write_text(re.sub(r'NEXT_PUBLIC_API_URL=.*', f'NEXT_PUBLIC_API_URL={api}',
                    e.read_text()))
apif = root / 'src/lib/api.ts'
s = apif.read_text().replace("?? 'http://localhost:4000'", f"?? '{api}'")
apif.write_text(s)

# theme hue: rewrite the first HSL component of the primary/ring tokens
if hue:
    g = root / 'src/app/globals.css'
    s = g.read_text()
    s = re.sub(r'(--(?:primary|ring|accent|brand):\s*)\d+(\s)', rf'\g<1>{hue}\g<2>', s)
    g.write_text(s)

print(f'scaffolded {name} -> {dest}')
PY

if [[ "$INSTALL" == "1" ]]; then
  ( cd "$DEST" && npm install )
fi

cat <<EOF

Next:
  cd "$DEST"
  ${INSTALL:+}$([[ "$INSTALL" == "1" ]] || echo 'npm install')
  npm run dev            # http://localhost:3001

Then, in order:
  1. Fix the envelope in src/types/index.ts + lib/api.ts against the real
     interceptor source. Nothing else works until this matches.
  2. Fix the login field in src/services/auth.ts (email vs identifier).
  3. Seed an admin account in the backend; a fresh DB cannot be logged into.
  4. Clone src/services/users.ts + the users page per entity.
  5. ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run verify
EOF
