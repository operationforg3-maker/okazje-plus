#!/bin/bash
set -e

# ==============================================================================
# Okazje-Plus Standardized Deployment Script
# ==============================================================================
# Ten skrypt jest ujednoliconym punktem wdrażania na produkcję.
# Domyślnie wdraża tylko backend, by uniknąć robienia commita. 
# Aby wdrożyć również aplikację Next.js, użyj flagi --all lub --frontend.

echo "======================================================================"
echo "🚀 Okazje-Plus Deployment CLI"
echo "======================================================================"

DEPLOY_FRONTEND=false
DEPLOY_BACKEND=false

# Argument parsing
if [ $# -eq 0 ]; then
  echo "Nie podano argumentów. Uruchamiam deployment tylko dla Backend-u (Cloud Functions + Firestore)."
  echo "Dostępne opcje: --all (Wszystko), --frontend (Tylko Next.js), --backend (Tylko Backend)"
  DEPLOY_BACKEND=true
fi

for arg in "$@"
do
    case $arg in
        --all|-a)
        DEPLOY_FRONTEND=true
        DEPLOY_BACKEND=true
        shift
        ;;
        --frontend|-f)
        DEPLOY_FRONTEND=true
        shift
        ;;
        --backend|-b)
        DEPLOY_BACKEND=true
        shift
        ;;
    esac
done

# 1. Wdrażanie Backend-u (Firebase CLI)
if [ "$DEPLOY_BACKEND" = true ]; then
  echo ""
  echo "⚙️ Wdrażanie komponentów Backend-owych (Cloud Functions & Firestore)..."
  
  # Zbuduj funkcje
  echo "-> Budowanie Cloud Functions..."
  npm --prefix okazje-plus run build

  # Wdróż funkcje i reguły
  echo "-> Wysyłanie do Firebase..."
  firebase deploy --only functions,firestore
  
  echo "✅ Backend wdrożony pomyślnie."
fi

# 2. Wdrażanie Frontend-u (Firebase App Hosting)
if [ "$DEPLOY_FRONTEND" = true ]; then
  echo ""
  echo "🌐 Wdrażanie aplikacji Next.js (Firebase App Hosting)..."
  
  # Sprawdzanie czy są nieskomitowane zmiany
  if [[ $(git status --porcelain) ]]; then
    echo "Masz nieskomitowane zmiany w repozytorium!"
    echo "Firebase App Hosting buduje aplikację z ostatniego commita wysłanego na GitHuba."
    
    read -p "Czy chcesz, aby skrypt automatycznie wykonał commit i wypchnął zmiany? (T/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[TtYy]$ ]] || [[ -z $REPLY ]]; then
      git add .
      git commit -m "Auto-deploy via deploy.sh"
    else
      echo "❌ Wdrażanie frontendu anulowane. Musisz ręcznie zcommitować i zrobić 'git push origin main'."
      exit 1
    fi
  fi
  
  # Wypychanie zmian na main (Firebase App Hosting automatycznie buduje z brancha main)
  echo "-> Wypychanie zmian na repozytorium GitHub (branch main)..."
  git push origin main
  
  echo "✅ Aplikacja wdrożona! Google Cloud Build rozpoczął właśnie budowanie w Firebase App Hosting."
  echo "Odwiedź konsolę Firebase (zakładka App Hosting), aby śledzić postęp budowania."
fi

echo ""
echo "🎉 Zakończono! Miłego dnia."
