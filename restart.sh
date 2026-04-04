#!/bin/bash

# Simple script to restart the EOS Photography Suite

echo "Stopping EOS Photography Suite..."
podman-compose down

echo "Starting EOS Photography Suite (rebuilding Focus-Stacking binary)..."
podman-compose up --build -d

echo "Suite is starting. Visit http://localhost:3000"
