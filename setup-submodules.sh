#!/bin/bash

# Exit on error
set -e

echo "Starting submodules setup..."

# Initialize submodules
echo "Initializing submodules..."
git submodule init

# Update submodules with force
echo "Updating submodules..."
git submodule update --init --recursive --force

# Check if elemento-gui-new exists and is not empty
if [ -d "elemento-gui-new" ] && [ "$(ls -A elemento-gui-new)" ]; then
    echo "Checking out main branch for elemento-gui-new..."
    cd elemento-gui-new
    git checkout main
    git pull origin main
    cd ..
else
    echo "Error: elemento-gui-new directory is empty or doesn't exist."
    echo "Try removing and re-cloning the submodule:"
    echo "1. git submodule deinit -f elemento-gui-new"
    echo "2. git rm -f elemento-gui-new"
    echo "3. rm -rf .git/modules/elemento-gui-new"
    echo "4. git submodule add git@github.com:your-repo/elemento-gui-new.git"
fi

echo "Setup process completed!" 