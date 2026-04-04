# Base image with Python and Node.js
FROM debian:bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    gnupg \
    libgphoto2-dev \
    libgphoto2-6 \
    hugin-tools \
    enblend \
    enfuse \
    pkg-config \
    gcc \
    g++ \
    make \
    libopencv-dev \
    libraw-dev \
    exiv2 \
    libraw-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy focus-stack source and build from source for perfect library compatibility
COPY focus-stack /app/focus-stack
WORKDIR /app/focus-stack
RUN make clean && make -j$(nproc) && cp build/focus-stack /usr/local/bin/focus-stack

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Set up work directory
WORKDIR /app

# Copy backend requirements and install
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip3 install --no-cache-dir -r /app/backend/requirements.txt --break-system-packages

# Copy frontend requirements and install
COPY frontend/package.json /app/frontend/package.json
WORKDIR /app/frontend
RUN npm install

# Copy the rest of the application
WORKDIR /app
COPY . .

# Create data directories
RUN mkdir -p /data/raw /data/processed /data/previews

# Expose ports: 3000 (Frontend), 8000 (Backend)
EXPOSE 3000 8000

# Start script with USB monitor kill loop
WORKDIR /app
RUN echo "#!/bin/bash\n\
# Prevent host from stealing camera via gvfs\n\
(while true; do pkill -9 -f gvfs-gphoto2-volume-monitor 2>/dev/null; sleep 10; done) &\n\
cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &\n\
cd /app/frontend && npm run dev -- --port 3000\n\
" > start.sh
RUN chmod +x start.sh

CMD ["./start.sh"]
