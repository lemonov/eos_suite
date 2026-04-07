#!/bin/bash
echo "Starting Micro EOS Suite..."
podman-compose up -d --build
echo "Suite is running! You can access it at http://localhost:3000"
