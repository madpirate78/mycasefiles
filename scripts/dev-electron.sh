#!/bin/bash

# Dev Electron Script - Builds React app and runs Electron
# This ensures no caching issues during development

echo "🚀 Building React app..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Starting Electron..."
    npm run electron
else
    echo "❌ Build failed! Check the errors above."
    exit 1
fi