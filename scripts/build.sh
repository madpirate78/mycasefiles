#!/bin/bash

# MyCaseFiles GitHub Actions Build Trigger
# Usage: ./scripts/build.sh or npm run build-menu

echo "🚀 MyCaseFiles GitHub Actions Build Trigger"
echo "=========================================="
echo ""
echo "Options:"
echo "  1) 🔨 Trigger Test Build (Build Test workflow)"
echo "  2) 📦 Trigger Release Build (Build and Release workflow)" 
echo "  3) 📊 Check recent build status"
echo "  4) 👀 Watch current build progress"
echo "  5) 🏷️  Create new release (patch version)"
echo "  6) 💻 Build locally for testing"
echo ""
read -p "Choose option (1-6): " choice

case $choice in
  1) 
    echo "🔨 Triggering test build..."
    gh workflow run "Build Test"
    echo "✅ Test build triggered! Use option 4 to watch progress."
    ;;
  2) 
    echo "📦 Triggering release build..."
    gh workflow run "Build and Release"
    echo "✅ Release build triggered! Use option 4 to watch progress."
    ;;
  3) 
    echo "📊 Recent build status:"
    gh run list --limit 10
    ;;
  4) 
    echo "👀 Watching current build..."
    gh run watch
    ;;
  5)
    echo "🏷️ Creating new patch release..."
    npm run version-patch
    echo "✅ Release created and build triggered automatically!"
    ;;
  6)
    echo "💻 Building locally..."
    npm run dist
    ;;
  *) 
    echo "❌ Invalid option. Please choose 1-6."
    ;;
esac