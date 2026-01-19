#!/bin/bash
# Script to start electros-electron app with dependencies

set -e  # Exit on error

# Get the directory where this script is located (handles symlinks)
SCRIPT_PATH="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_PATH" ]; do
    SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
    [[ $SCRIPT_PATH != /* ]] && SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "ElectrOS Electron App - Setup & Start"
echo "=========================================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in PATH"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found"
    exit 1
fi

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
    echo "Dependencies installed"
else
    echo "Dependencies already installed"
fi

echo ""
echo "=========================================="
echo "Starting ElectrOS Electron App..."
echo "=========================================="
echo ""

# Start the electron app
npm run start
