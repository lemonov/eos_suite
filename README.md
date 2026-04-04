# EOS Photography Suite

![EOS Suite Logo](assets/logo.png)

A comprehensive, containerized photography studio designed for Canon EOS cameras. **EOS Photography Suite** bridges the gap between hardware and high-end image processing, offering a streamlined workflow for tethered shooting and automated focus stacking.

## 🌟 Key Features

-   **📸 Professional Tethered Control**: Complete control over your Canon EOS camera settings (ISO, Aperture, Shutter Speed, Focus) directly from the web interface.
-   **📑 Automated Z-Stacking**: Precision focus stacking with sub-step control for high-resolution macro photography.
-   **🖼️ Real-time Live View**: High-performance live preview for perfect framing and focus adjustment.
-   **⚡ High-Performance Processing**: Backend powered by Python with `gphoto2` for native hardware communication and `OpenCV` for image processing.
-   **🖥️ Modern Web UI**: A sleek, responsive dashboard built with Next.js and TypeScript, designed for professional photographers.
-   **🐳 Containerized Deployment**: Fully portable environment using Podman/Docker, ensuring consistent performance across systems.

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
  - Integrated with **FastAPI** for high-concurrency API requests.
  - Native **GPhoto2** bindings for deep camera control level access.
  - **OpenCV** & **RawPy** for high-performance raw image processing.
  - **Stacking Engine**: Custom integration of Z-stacking algorithms for maximized depth of field.
- **Frontend (Next.js 15)**: 
  - Modern dashboard built with **React** and **TypeScript**.
  - Real-time live view streaming and dynamic focus management.
  - Professional UI/UX inspired by darktable and Lightroom.

## ⚠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **"Could not claim USB device"** | Ensure no other app (Darktable, GNOME Files) is using the camera. Run the `pkill` command above. |
| **"Camera not detected"** | Check USB connection and ensure camera is powered on. Try `gphoto2 --auto-detect` inside the container. |
| **"Live View Lag"** | Ensure you are using a USB 3.0 port and a high-quality cable. |

---
*Built as a professional workstation for macro and studio photographers.*
