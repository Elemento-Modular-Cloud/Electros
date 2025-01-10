#!/bin/bash

echo "Building..."

cmake -B build
cmake --build build --config Release --clean-first

echo "Build complete!"