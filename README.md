# EOS Photography Suite

![EOS Suite Logo](assets/logo.png)

A comprehensive, containerized photography studio designed for Canon EOS cameras. **EOS Photography Suite** bridges the gap between hardware and high-end image processing, offering a streamlined workflow for tethered shooting and automated focus stacking.

## 🌟 Key Features

-   **📸 Professional Tethered Control**: Complete control over your Canon EOS camera settings (ISO, Aperture, Shutter Speed, Focus) directly from the web interface.
-   **📑 Automated Z-Stacking**: Precision focus stacking with sub-step control, integrating advanced OpenCV blending algorithms to merge deep focus macro shots flawlessly.
-   **🖼️ True Streaming Live View**: High-performance HTTP MJPEG live stream backend that can smoothly expand into immersive, non-obstructive full-screen portals for pristine focus checks.
-   **🎨 Infinite Canvas Compositions**: A full creative suite featuring movable layers, opacity dialing, varied blend modes (Screen, Multiply, Overlay), image flipping, composite Gallery exports, and robust JSON project state saving & loading.
-   **⚡ High-Performance Processing & Raw Translation**: A backend securely anchored by Python and `gphoto2` that intelligently converts `.cr2` RAW camera formats into lossless, optimized, web-ready PNGs dynamically via OpenCV.
-   **🖥️ Modern Web UI**: A sleek, responsive dashboard built with Next.js and TypeScript, giving you quick Lighttable previews of your assets and granular control.
-   **🐳 Containerized Deployment**: Fully portable environment using Podman/Docker, ensuring consistent performance, auto-healing backgrounds, and network ease across systems.

## 🛠️ Tech Stack

-   **Frontend**: [Next.js](https://nextjs.org/), [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/)
-   **Backend**: [FastAPI](https://fastapi.tiangolo.com/), [GPhoto2](http://gphoto.org/), [OpenCV](https://opencv.org/)
-   **Stacking Engine**: Specialized focus stacking algorithms for maximum clarity.
-   **Infrastructure**: [Podman](https://podman.io/) / [Docker](https://www.docker.com/)

## 🚀 Quick Start

Follow these steps to set up your professional photography studio in minutes.

### 🔌 1. Hardware Preparation
- **Camera Connection**: Connect your Canon EOS camera via a high-speed USB cable.
- **Mode Selection**: Set your camera to **Manual (M)** mode for full software control.
- **Auto-Power Off**: Disable 'Auto-Power Off' in your camera menu to prevent connection drops.

### 🧹 2. Linux Environment Cleanup (Recommended)
If you are running on GNOME, background services might capture the camera. Kill them to free up the device:
```bash
pkill -f gvfs-gphoto2-volume-monitor
```

### 🐳 3. Deployment
The easiest way to run the stack is using **Podman Compose** (or Docker Compose):
```bash
# Start the entire suite
podman-compose up --build
```

### 🌍 4. Launch the Dashboard
Your photography studio is now live!
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Technical Architecture

- **Backend (Python 3.x)**: 
  - Integrated with **FastAPI** for high-concurrency API requests, including an asynchronous background `yield` generator for continuous MJPEG Live View bridging.
  - Native **GPhoto2** bindings for deep camera control level access that maintains singular state threads.
  - **OpenCV** & **RawPy** algorithms handling automatic backend image normalization to compressed lossless formats, generating swift Lighttable interactions.
  - **Stacking Engine**: Custom integration of Z-stacking compilation binaries for maximized depth of field processing.
- **Frontend (Next.js 16)**: 
  - Modern dashboard built with **React** and **TypeScript** leveraging Context Hooks, Ref arrays, and portal-driven DOM mutations.
  - Interactive **Konva.js** powered Canvas engine supporting transform selections.
  - Professional UI/UX inspired by darktable and Lightroom with dark-mode optimized aesthetics.

## ⚠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **"Could not claim USB device"** | Ensure no other app (Darktable, GNOME Files) is using the camera. Run the `pkill` command above. |
| **"Camera not detected"** | Check USB connection and ensure camera is powered on. Try `gphoto2 --auto-detect` inside the container. |
| **"Live View Lag"** | Ensure you are using a USB 3.0 port and a high-quality cable. |

---
*Built as a professional workstation for macro and studio photographers.*
