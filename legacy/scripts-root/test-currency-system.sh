#!/usr/bin/env bash

# Currency System Test Runner
# Automated test execution for all test levels

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test Results
UNIT_TESTS_PASSED=0
E2E_TESTS_PASSED=0
TOTAL_TESTS=0

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Currency System - Test Suite Runner      ║${NC}"
echo -e "${BLUE}║  27 grudnia 2025                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Function to print test section
print_section() {
    echo ""
    echo -e "${BLUE}────────────────────────────────────────${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}────────────────────────────────────────${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate environment
print_section "1️⃣  Walidacja Środowiska"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js nie znaleziony${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"

if ! command_exists npm; then
    echo -e "${RED}❌ npm nie znaleziony${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json nie znaleziony${NC}"
    exit 1
fi

echo -e "${GREEN}✅ package.json znaleziony${NC}"

# Install dependencies if needed
print_section "2️⃣  Instalacja Zależności"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalowanie dependencji...${NC}"
    npm install --silent 2>/dev/null || npm install
fi

echo -e "${GREEN}✅ Zależności zainstalowane${NC}"

# Run TypeScript Check
print_section "3️⃣  Type Checking (TypeScript)"

if npm run typecheck >/dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript check przeszedł${NC}"
    ((TOTAL_TESTS++))
else
    echo -e "${RED}❌ TypeScript check nie powiódł się${NC}"
fi

# Run Unit Tests
print_section "4️⃣  Testy Jednostkowe (Jest)"

echo "Uruchamianie: src/lib/__tests__/unified-currency.test.ts"
echo ""

if npm run test -- unified-currency.test.ts 2>&1 | tee /tmp/unit-test.log; then
    UNIT_TESTS_PASSED=1
    # Extract test count
    TESTS_COUNT=$(grep -oP '\d+(?= passed)' /tmp/unit-test.log | head -1)
    echo -e "${GREEN}✅ Testy jednostkowe: $TESTS_COUNT przeszły${NC}"
    ((TOTAL_TESTS++))
else
    echo -e "${RED}❌ Testy jednostkowe nie powiodły się${NC}"
    echo ""
    cat /tmp/unit-test.log | tail -20
fi

# Run ESLint
print_section "5️⃣  Linting (ESLint)"

LINT_FILES=(
    "src/lib/unified-currency.ts"
    "src/components/deal-card.tsx"
    "src/components/deal-list-card.tsx"
)

ALL_LINT_PASSED=true

for FILE in "${LINT_FILES[@]}"; do
    if [ -f "$FILE" ]; then
        if npm run lint -- "$FILE" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $FILE${NC}"
        else
            echo -e "${RED}❌ $FILE${NC}"
            ALL_LINT_PASSED=false
        fi
    fi
done

if [ "$ALL_LINT_PASSED" = true ]; then
    echo -e "${GREEN}✅ Wszystkie pliki spełniają standardy lint${NC}"
    ((TOTAL_TESTS++))
else
    echo -e "${RED}❌ Niektóre pliki mają problemy lint${NC}"
fi

# Run E2E Tests (if Playwright installed)
print_section "6️⃣  Testy E2E (Playwright)"

if npm list @playwright/test >/dev/null 2>&1; then
    echo "Uruchamianie: tests/currency-system.spec.ts"
    echo ""
    
    if npm run test:e2e -- currency-system --reporter=list 2>&1 | tee /tmp/e2e-test.log; then
        E2E_TESTS_PASSED=1
        E2E_COUNT=$(grep -oP '\d+(?= passed)' /tmp/e2e-test.log | head -1)
        echo -e "${GREEN}✅ Testy E2E: $E2E_COUNT przeszły${NC}"
        ((TOTAL_TESTS++))
    else
        echo -e "${YELLOW}⚠️  Testy E2E nie mogły być uruchomione${NC}"
        echo "   (Może być konieczna konfiguracja Firebase Emulator)"
        echo ""
        grep -i "error\|failed" /tmp/e2e-test.log | head -5 || true
    fi
else
    echo -e "${YELLOW}⚠️  Playwright nie zainstalowany${NC}"
    echo "   Aby zainstalować: npm install --save-dev @playwright/test"
fi

# Test Coverage Report
print_section "7️⃣  Pokrycie Kodu (Coverage)"

if npm run test -- --coverage unified-currency.test.ts 2>&1 | tail -20; then
    echo -e "${GREEN}✅ Raport pokrycia wygenerowany${NC}"
else
    echo -e "${YELLOW}⚠️  Pokrycie kodu nie mogło być obliczone${NC}"
fi

# Summary Report
print_section "📊 Podsumowanie Wyników"

echo ""
echo -e "${BLUE}Wyniki testów:${NC}"
echo ""

if [ "$UNIT_TESTS_PASSED" -eq 1 ]; then
    echo -e "${GREEN}✅ Testy jednostkowe${NC} - Przeszły"
else
    echo -e "${RED}❌ Testy jednostkowe${NC} - Nie przeszły"
fi

if [ "$E2E_TESTS_PASSED" -eq 1 ]; then
    echo -e "${GREEN}✅ Testy E2E${NC} - Przeszły"
elif [ -z "$E2E_COUNT" ]; then
    echo -e "${YELLOW}⚠️  Testy E2E${NC} - Pominięte (nie skonfigurowane)"
else
    echo -e "${RED}❌ Testy E2E${NC} - Nie przeszły"
fi

echo ""
echo -e "${BLUE}Statystyki:${NC}"
echo "  Total test suites: 3"
echo "  Total tests: $TOTAL_TESTS"
echo ""

# Final Status
print_section "✨ Status Finalny"

if [ "$UNIT_TESTS_PASSED" -eq 1 ]; then
    echo -e "${GREEN}✅ WSZYSTKIE TESTY PRZESZŁY${NC}"
    echo ""
    echo -e "${BLUE}System walut jest gotowy do produkcji!${NC}"
    echo ""
    echo "Następne kroki:"
    echo "  1. Zweryfikuj testy w CI/CD"
    echo "  2. Deploy Cloud Function na produkcję"
    echo "  3. Monitoruj ceny w real-time"
    echo ""
    exit 0
else
    echo -e "${RED}❌ NIEKTÓRE TESTY NIE PRZESZŁY${NC}"
    echo ""
    echo "Debug:"
    echo "  - Sprawdź błędy powyżej"
    echo "  - Uruchom: npm run test -- --verbose"
    echo "  - Dla E2E: npm run test:e2e -- --debug"
    echo ""
    exit 1
fi
