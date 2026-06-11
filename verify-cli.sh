#!/bin/bash

# Prosty skrypt do weryfikacji konfiguracji gcloud i firebase CLI
# Użycie: ./verify-cli.sh

# --- Definicje kolorów dla czytelności ---
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_NC='\033[0m' # No Color

print_success() {
  echo -e "${COLOR_GREEN}✅  SUCCESS:${COLOR_NC} $1"
}

print_error() {
  echo -e "${COLOR_RED}❌  ERROR:${COLOR_NC} $1"
}

print_info() {
  echo -e "${COLOR_BLUE}ℹ️  INFO:${COLOR_NC} $1"
}

echo "--- Rozpoczynam weryfikację konfiguracji CLI dla projektu OkazjePlus ---"
echo ""

# --- 1. Weryfikacja gcloud CLI ---
echo "--- Sprawdzanie Google Cloud (gcloud) CLI ---"
if ! command -v gcloud &> /dev/null; then
    print_error "Narzędzie 'gcloud' nie jest zainstalowane."
    print_info "Zainstaluj Google Cloud SDK, postępując zgodnie z instrukcją: https://cloud.google.com/sdk/docs/install"
    GCLOUD_OK=false
else
    print_success "Narzędzie 'gcloud' jest zainstalowane."
    
    # Sprawdzenie, czy użytkownik jest zalogowany
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    if [ -z "$ACTIVE_ACCOUNT" ]; then
        print_error "Nie jesteś zalogowany do gcloud."
        print_info "Użyj komendy 'gcloud auth login' aby się zalogować."
        GCLOUD_OK=false
    else
        print_success "Jesteś zalogowany do gcloud jako: $ACTIVE_ACCOUNT"
        
        # Sprawdzenie aktywnego projektu
        ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null)
        if [ -z "$ACTIVE_PROJECT" ]; then
            print_error "Brak aktywnego projektu w konfiguracji gcloud."
            print_info "Ustaw projekt za pomocą komendy: 'gcloud config set project NAZWA_PROJEKTU'"
            GCLOUD_OK=false
        else
            print_success "Aktywny projekt gcloud: $ACTIVE_PROJECT"
            GCLOUD_OK=true
        fi
    fi
fi
echo ""

# --- 2. Weryfikacja Firebase CLI ---
echo "--- Sprawdzanie Firebase CLI ---"
if ! command -v firebase &> /dev/null; then
    print_error "Narzędzie 'firebase' nie jest zainstalowane."
    print_info "Zainstaluj Firebase CLI za pomocą komendy: 'npm install -g firebase-tools'"
    FIREBASE_OK=false
else
    print_success "Narzędzie 'firebase' jest zainstalowane."
    
    # Sprawdzenie, czy użytkownik jest zalogowany (firebase projects:list wymaga zalogowania)
    if ! firebase projects:list > /dev/null 2>&1; then
        print_error "Nie jesteś zalogowany do Firebase lub wystąpił błąd."
        print_info "Użyj komendy 'firebase login' aby się zalogować."
        FIREBASE_OK=false
    else
        print_success "Jesteś poprawnie zalogowany do Firebase."
        FIREBASE_OK=true
    fi
fi
echo ""

# --- Podsumowanie ---
echo "--- Podsumowanie weryfikacji ---"
if [ "$GCLOUD_OK" = true ] && [ "$FIREBASE_OK" = true ]; then
    print_success "Wszystkie narzędzia CLI są poprawnie skonfigurowane. Możesz zaczynać!"
else
    print_error "Wykryto problemy z konfiguracją. Sprawdź powyższe komunikaty."
fi
echo ""