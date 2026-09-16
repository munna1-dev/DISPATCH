#!/bin/sh

echo "===== PROJECT FILES ====="
find . -not -path './node_modules/*' -not -path './.git/*' | sort

echo ""
echo "===== JAVASCRIPT SYNTAX ERRORS ====="

find . -type f -name "*.js" \
  -not -path './node_modules/*' \
  -not -path './.git/*' \
  -print0 |
while IFS= read -r -d '' file; do
    echo "Checking: $file"
    node --check "$file" 2>&1
done

echo ""
echo "===== JSON ERRORS ====="

find . -type f -name "*.json" \
  -not -path './node_modules/*' \
  -not -path './.git/*' \
  -print0 |
while IFS= read -r -d '' file; do
    echo "Checking: $file"
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$file" 2>&1
done

echo ""
echo "===== PACKAGE ====="

if [ -f package.json ]; then
    cat package.json
else
    echo "No package.json"
fi

echo ""
echo "===== CHECK COMPLETE ====="
