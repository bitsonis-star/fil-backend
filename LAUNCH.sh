#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  FiL — One-shot launch script
#  Run this from inside the fil-backend folder.
#  It walks you through every step interactively.
# ════════════════════════════════════════════════════════════════

set -e
TEAL='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

header() { echo -e "\n${TEAL}══ $1 ══${NC}\n"; }
ok()     { echo -e "${GREEN}✓ $1${NC}"; }
warn()   { echo -e "${YELLOW}⚠ $1${NC}"; }
ask()    { echo -e "${TEAL}?${NC} $1"; }

clear
echo -e "${TEAL}"
echo "  ███████╗██╗██╗      "
echo "  ██╔════╝██║██║      "
echo "  █████╗  ██║██║      "
echo "  ██╔══╝  ██║██║      "
echo "  ██║     ██║███████╗ "
echo "  ╚═╝     ╚═╝╚══════╝ "
echo -e "${NC}  Full in Life — Launch script\n"

# ── Step 1: Check tools ──────────────────────────────────────────
header "Step 1/7: Checking tools"

command -v node >/dev/null 2>&1 && ok "Node.js $(node -v)" || { echo -e "${RED}✗ Node.js not found. Install from nodejs.org${NC}"; exit 1; }
command -v git  >/dev/null 2>&1 && ok "Git $(git --version | cut -d' ' -f3)" || { echo -e "${RED}✗ Git not found. Install from git-scm.com${NC}"; exit 1; }
command -v npm  >/dev/null 2>&1 && ok "npm $(npm -v)" || { echo -e "${RED}✗ npm not found${NC}"; exit 1; }

# ── Step 2: Install dependencies ────────────────────────────────
header "Step 2/7: Installing dependencies"
npm install
ok "Dependencies installed"

# ── Step 3: Check .env ──────────────────────────────────────────
header "Step 3/7: Checking environment variables"

if [ ! -f .env ]; then
  warn ".env file not found — creating from template"
  cp .env.example .env
  echo ""
  echo -e "${YELLOW}ACTION REQUIRED:${NC}"
  echo "  Open .env in any text editor and fill in all the PASTE_HERE values."
  echo "  Then run this script again."
  echo ""
  echo "  Quick open:"
  echo "    Mac:    open .env"
  echo "    Linux:  nano .env"
  echo "    Windows: notepad .env"
  exit 0
fi

# Check for unfilled values
UNFILLED=$(grep "PASTE_HERE\|PASTE_OPENSSL\|your-domain" .env | grep -v "^#" | wc -l)
if [ "$UNFILLED" -gt "0" ]; then
  warn "$UNFILLED values still need to be filled in .env:"
  grep "PASTE_HERE\|PASTE_OPENSSL\|your-domain" .env | grep -v "^#"
  echo ""
  echo "Fill these in and run again."
  exit 1
fi
ok "All environment variables present"

# ── Step 4: Build ────────────────────────────────────────────────
header "Step 4/7: Building"
npm run build
ok "Build successful"

# ── Step 5: Database migrations ─────────────────────────────────
header "Step 5/7: Running database migrations"
echo "This connects to your Railway MySQL database and creates all tables."
ask "Press Enter to run migrations (or Ctrl+C to skip for now)..."
read
npm run db:push
ok "Database migrations complete"

# ── Step 6: Git push ─────────────────────────────────────────────
header "Step 6/7: Pushing to GitHub"

if [ ! -d .git ]; then
  git init
  git add .
  git commit -m "FiL backend v1 — ready for Railway"
  echo ""
  ask "Enter your GitHub repo URL (e.g. https://github.com/yourname/fil-backend.git):"
  read REPO_URL
  git remote add origin "$REPO_URL"
  git push -u origin main
  ok "Pushed to GitHub"
else
  git add .
  git commit -m "FiL deploy $(date '+%Y-%m-%d %H:%M')" || ok "Nothing new to commit"
  git push
  ok "Pushed to GitHub — Railway will auto-deploy in ~2 minutes"
fi

# ── Step 7: Summary ──────────────────────────────────────────────
header "Step 7/7: Done"

echo -e "${GREEN}"
echo "  ✓ Code built"
echo "  ✓ Database migrated"
echo "  ✓ Pushed to GitHub"
echo -e "${NC}"
echo "Railway is now deploying your backend automatically."
echo "Check progress at: https://railway.app → your project → Deployments"
echo ""
echo "Next steps:"
echo "  1. Add custom domain in Railway → Settings → Domains"
echo "  2. Add Stripe webhook (see DEPLOY.md)"
echo "  3. Build the mobile app: cd ../fil-expo && eas build --platform all"
echo ""
echo -e "${TEAL}Your FiL backend is live. 🎉${NC}"
