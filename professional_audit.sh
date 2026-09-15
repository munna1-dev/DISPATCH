#!/bin/sh

PROJECT="/public/Tracker"
REPORT="$PROJECT/professional-audit-report.txt"

cd "$PROJECT" || exit 1

{
echo "============================================================"
echo "             US COURIER PROFESSIONAL QA AUDIT"
echo "============================================================"
echo "Date: $(date)"
echo "Project: $PROJECT"
echo

echo "============================================================"
echo "1. PROJECT STRUCTURE"
echo "============================================================"

find . \
  -path './node_modules' -prune -o \
  -path './.git' -prune -o \
  -type f -print | sort

echo

echo "============================================================"
echo "2. GIT STATUS"
echo "============================================================"

git status --short 2>/dev/null || true

echo

echo "============================================================"
echo "3. PACKAGE INFORMATION"
echo "============================================================"

if [ -f package.json ]; then
  cat package.json
else
  echo "WARNING: package.json not found"
fi

echo

echo "============================================================"
echo "4. JAVASCRIPT SYNTAX"
echo "============================================================"

for file in \
  server.js \
  public/js/app.js \
  public/js/admin.js
do
  if [ -f "$file" ]; then
    echo
    echo "Checking: $file"

    if node --check "$file" 2>&1; then
      echo "PASS: $file"
    else
      echo "FAIL: $file"
    fi
  else
    echo "NOT FOUND: $file"
  fi
done

echo

echo "============================================================"
echo "5. GIT DIFF CHECK"
echo "============================================================"

git diff --check 2>&1 || true

echo

echo "============================================================"
echo "6. HTML FILES"
echo "============================================================"

find public -type f -name '*.html' -print | sort

echo

echo "============================================================"
echo "7. JAVASCRIPT FILES"
echo "============================================================"

find public -type f -name '*.js' -print | sort

echo

echo "============================================================"
echo "8. CSS FILES"
echo "============================================================"

find public -type f -name '*.css' -print | sort

echo

echo "============================================================"
echo "9. HTML IDs"
echo "Checking for duplicate IDs"
echo "============================================================"

for file in $(find public -type f -name '*.html' 2>/dev/null); do

  echo
  echo "FILE: $file"

  grep -oE 'id=["'\''][^"'\'']+["'\'']' "$file" 2>/dev/null \
    | sed 's/^id=["'\'']//;s/["'\'']$//' \
    | sort \
    | uniq -d \
    | while read id
  do
    echo "DUPLICATE ID: $id"
  done

done

echo

echo "============================================================"
echo "10. ONCLICK / HTML JAVASCRIPT HANDLERS"
echo "============================================================"

grep -Rni \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  -E 'onclick=|onsubmit=|onchange=|oninput=|onload=' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "11. JAVASCRIPT FUNCTION DEFINITIONS"
echo "============================================================"

grep -Rni \
  --include='*.js' \
  --exclude-dir=node_modules \
  -E 'function[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*[[:space:]]*\(' \
  public server.js 2>/dev/null || true

echo

echo "============================================================"
echo "12. JAVASCRIPT EVENT LISTENERS"
echo "============================================================"

grep -Rni \
  --include='*.js' \
  --exclude-dir=node_modules \
  -E 'addEventListener|onclick|onsubmit|onchange' \
  public/js 2>/dev/null || true

echo

echo "============================================================"
echo "13. FETCH / API CALLS"
echo "============================================================"

grep -Rni \
  --include='*.js' \
  --exclude-dir=node_modules \
  -E 'fetch\(|/api/' \
  public/js server.js 2>/dev/null || true

echo

echo "============================================================"
echo "14. BACKEND ROUTES"
echo "============================================================"

grep -nE \
  'app\.(get|post|put|patch|delete)\(' \
  server.js 2>/dev/null || true

echo

echo "============================================================"
echo "15. ADMIN SECURITY MIDDLEWARE"
echo "Checking admin endpoints"
echo "============================================================"

grep -nE \
  'authMiddleware|adminMiddleware|requireSameOrigin' \
  server.js 2>/dev/null || true

echo

echo "============================================================"
echo "16. SQL OPERATIONS"
echo "============================================================"

grep -nEi \
  'SELECT|INSERT|UPDATE|DELETE|FROM |JOIN |WHERE ' \
  server.js 2>/dev/null || true

echo

echo "============================================================"
echo "17. DANGEROUS HTML / XSS REVIEW"
echo "============================================================"

grep -Rni \
  --include='*.js' \
  --exclude-dir=node_modules \
  -E 'innerHTML|outerHTML|insertAdjacentHTML|document\.write' \
  public/js 2>/dev/null || true

echo

echo "============================================================"
echo "18. DEBUG / DEMO TEXT"
echo "============================================================"

grep -RniEi \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  'test|testing|debug|todo|fixme|placeholder|sample|example|lorem|tooo|abc' \
  public server.js 2>/dev/null || true

echo

echo "============================================================"
echo "19. CONSOLE LOGGING"
echo "Review these manually; not all console logging is an error."
echo "============================================================"

grep -Rni \
  --include='*.js' \
  --exclude-dir=node_modules \
  -E 'console\.(log|error|warn|debug)' \
  public/js server.js 2>/dev/null || true

echo

echo "============================================================"
echo "20. POSSIBLE SECRETS / CREDENTIAL REFERENCES"
echo "Values are NOT printed."
echo "============================================================"

grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='professional-audit-report.txt' \
  'API_KEY|SECRET_KEY|PASSWORD|DB_PASSWORD|DATABASE_URL|SERVICE_ROLE|ACCESS_TOKEN|PRIVATE_KEY' \
  . 2>/dev/null \
  | sed -E 's/(:|=)[[:space:]]*[^[:space:]]+/\1 [REDACTED]/g' \
  || true

echo

echo "============================================================"
echo "21. ENVIRONMENT FILES"
echo "============================================================"

find . \
  -path './node_modules' -prune -o \
  -path './.git' -prune -o \
  -type f \( \
    -name '.env' \
    -o -name '.env.local' \
    -o -name '.env.production' \
  \) \
  -print 2>/dev/null

echo

echo "============================================================"
echo "22. PUBLIC TRACKING PRIVACY REVIEW"
echo "============================================================"

echo "Public tracking route references:"
grep -nEi \
  '/api/tracking|tracking/:tracking|trackingNumber' \
  server.js 2>/dev/null || true

echo
echo "Potential private fields in server.js:"
grep -nEi \
  'sender_name|recipient_name|declared_value|currency|latitude|longitude|password|token|secret' \
  server.js 2>/dev/null || true

echo

echo "============================================================"
echo "23. TRACKING EVENT SYSTEM"
echo "============================================================"

grep -nEi \
  'shipment_events|tracking-events|loadAdminShipmentEvents|handleTrackingEventEditSubmit|openEditTrackingEventModal|viewShipmentTracking' \
  server.js public/js/admin.js public/index.html 2>/dev/null || true

echo

echo "============================================================"
echo "24. PRINT / RECEIPT SYSTEM"
echo "============================================================"

grep -nEi \
  'print|receipt|qrcode|printable-receipt' \
  public/index.html public/js/app.js public/js/admin.js 2>/dev/null || true

echo

echo "============================================================"
echo "25. FORMS"
echo "============================================================"

grep -Rni \
  --include='*.html' \
  -E '<form|onsubmit=|<input|<select|<textarea|type=["'\'']submit' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "26. BUTTONS"
echo "============================================================"

grep -Rni \
  --include='*.html' \
  -E '<button|type=["'\'']button|type=["'\'']submit' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "27. LINKS"
echo "============================================================"

grep -Rni \
  --include='*.html' \
  -E 'href=' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "28. MODALS"
echo "============================================================"

grep -Rni \
  --include='*.html' \
  -E 'modal-|modal-overlay|showModal|hideModal' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "29. RESPONSIVE DESIGN"
echo "============================================================"

grep -Rni \
  --include='*.css' \
  -E '@media|viewport|overflow-x|overflow-y' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "30. ACCESSIBILITY"
echo "============================================================"

echo "Images without obvious alt attributes:"
grep -Rni \
  --include='*.html' \
  '<img' \
  public 2>/dev/null \
  | grep -v 'alt=' || true

echo

echo "Buttons without obvious text/icon content:"
grep -Rni \
  --include='*.html' \
  '<button' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "31. BROKEN / SUSPICIOUS REFERENCES"
echo "============================================================"

echo "JavaScript source references:"
grep -Rni \
  --include='*.html' \
  -E '<script[^>]+src=' \
  public 2>/dev/null || true

echo

echo "Stylesheet references:"
grep -Rni \
  --include='*.html' \
  -E '<link[^>]+stylesheet' \
  public 2>/dev/null || true

echo

echo "============================================================"
echo "32. DEPENDENCY AUDIT"
echo "============================================================"

if command -v npm >/dev/null 2>&1; then
  npm audit --omit=dev 2>&1 || true
else
  echo "npm not available"
fi

echo

echo "============================================================"
echo "33. LIVE LOCAL SERVER"
echo "============================================================"

if command -v curl >/dev/null 2>&1; then

  echo "Testing http://localhost:3000/api/health"

  curl -sS -i \
    --max-time 10 \
    http://localhost:3000/api/health \
    2>&1 || true

else
  echo "curl not available"
fi

echo

echo "============================================================"
echo "34. FINAL VALIDATION"
echo "============================================================"

echo
echo "server.js:"
node --check server.js 2>&1 || true

echo
echo "public/js/app.js:"
node --check public/js/app.js 2>&1 || true

echo
echo "public/js/admin.js:"
node --check public/js/admin.js 2>&1 || true

echo
echo "git diff --check:"
git diff --check 2>&1 || true

echo

echo "============================================================"
echo "AUDIT COMPLETE"
echo "============================================================"
echo
echo "IMPORTANT:"
echo "This automated audit identifies likely problems."
echo "Browser interaction, visual quality, and complete user journeys"
echo "still require manual testing."
echo
echo "NO FILES WERE MODIFIED BY THIS AUDIT."
echo "NO COMMIT WAS CREATED."
echo "NO PUSH WAS PERFORMED."
echo

} > "$REPORT"

echo
echo "============================================================"
echo "AUDIT FINISHED"
echo "============================================================"
echo
echo "Report created:"
echo "$REPORT"
echo
echo "To view the report:"
echo "cat professional-audit-report.txt"
echo
echo "To view only important findings:"
echo "grep -nEi 'FAIL|WARNING|DUPLICATE|NOT FOUND|SECRET|TODO|FIXME|ERROR' professional-audit-report.txt"
echo
