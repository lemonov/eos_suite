import gphoto2 as gp
import os
import time
import logging
import rawpy
import cv2
import numpy as np
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CameraManager:
    def __init__(self, storage_path="/data/raw"):
        self.camera = None
        self.storage_path = storage_path
        self.previews_path = "/data/previews"
        self.normalized_path = "/data/normalized"
        self._lock = threading.Lock()
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path)
        if not os.path.exists(self.previews_path):
            os.makedirs(self.previews_path)
        if not os.path.exists(self.normalized_path):
            os.makedirs(self.normalized_path)

    def _ensure_connected(self):
        """Connect to camera if not already connected. Thread-safe."""
        if self.camera is not None:
            return True
        try:
            self.camera = gp.Camera()
            self.camera.init()
            logger.info("Camera connected successfully")
            return True
        except gp.GPhoto2Error as ex:
            logger.error(f"Failed to connect: {ex}")
            self.camera = None
            return False

    def _release(self):
        """Release camera connection safely."""
        if self.camera:
            try:
                self.camera.exit()
            except:
                pass
            self.camera = None

    def connect(self):
        """Check connectivity (used by status endpoint). Reuses existing connection."""
        with self._lock:
            return self._ensure_connected()

    def capture_image(self):
        with self._lock:
            # Force fresh connection for capture
            self._release()
            if not self._ensure_connected():
                return None

            for attempt in range(3):
                try:
                    # Capture the image
                    file_path = self.camera.capture(gp.GP_CAPTURE_IMAGE)
                    logger.info(f"Captured image to camera path: {file_path.folder}/{file_path.name}")

                    # Wait for camera to be ready (Canon EOS needs time to write to card)
                    time.sleep(0.5)

                    # Download the image — use timestamp-based name to avoid overwrites
                    # Camera reuses names like capt0000.cr2 which causes collisions
                    ext = os.path.splitext(file_path.name)[1]  # .cr2, .jpg, etc.
                    timestamp = time.strftime("%Y%m%d_%H%M%S")
                    # Add a counter suffix to handle rapid captures within the same second
                    counter = 0
                    while True:
                        unique_name = f"IMG_{timestamp}_{counter:03d}{ext}"
                        target = os.path.join(self.storage_path, unique_name)
                        if not os.path.exists(target):
                            break
                        counter += 1
                    
                    logger.info(f"Downloading image to final path: {target}")
                    camera_file = self.camera.file_get(file_path.folder, file_path.name, gp.GP_FILE_TYPE_NORMAL)
                    camera_file.save(target)
                    
                    # Verify the file landed on disk
                    time.sleep(0.2)
                    if not os.path.exists(target):
                        logger.error(f"File not found after save: {target}")
                        continue
                        
                    file_size = os.path.getsize(target)
                    if file_size < 1000:
                        logger.error(f"File too small ({file_size} bytes), likely corrupt: {target}")
                        os.remove(target)
                        continue
                    
                    logger.info(f"Downloaded image to: {target} ({file_size} bytes)")
                    
                    # Generate BMP normalized version
                    normalized_path = self._normalize_to_bmp(target)
                    if normalized_path:
                        logger.info(f"Normalized BMP ready: {normalized_path}")
                    else:
                        logger.warning(f"BMP normalization failed for {target}")

                    # Generate preview if it's a RAW file
                    if target.lower().endswith(".cr2"):
                        preview_path = self._generate_jpg_preview(target)
                        if preview_path:
                            logger.info(f"Preview ready: {preview_path}")
                        else:
                            logger.warning(f"Preview generation failed for {target}, but RAW file is saved")
                    
                    return target
                except gp.GPhoto2Error as ex:
                    logger.error(f"Capture attempt {attempt+1}/3 failed: {ex}")
                    # Reconnect between retries
                    self._release()
                    time.sleep(1)
                    if not self._ensure_connected():
                        break
                    continue
            
            logger.error("All capture attempts failed")
            return None

    def _generate_jpg_preview(self, raw_path):
        """Generate a JPEG preview from a RAW file. Called while lock is held."""
        try:
            logger.info(f"Generating JPG preview for {raw_path}")
            with rawpy.imread(raw_path) as raw:
                rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=True, bright=1.0)
                
                # Resize to smaller resolution (max 1024px)
                h, w = rgb.shape[:2]
                max_dim = 1024
                if w > max_dim or h > max_dim:
                    scale = max_dim / max(h, w)
                    new_w, new_h = int(w * scale), int(h * scale)
                    rgb = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_AREA)
                
                base_name = os.path.basename(raw_path)
                preview_name = os.path.splitext(base_name)[0] + ".jpg"
                preview_target = os.path.join(self.previews_path, preview_name)
                
                bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                success = cv2.imwrite(preview_target, bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
                if not success:
                    logger.error(f"Failed to write JPG preview to {preview_target}")
                    return None
                
                logger.info(f"Generated JPG preview at: {preview_target}")
                return preview_target
        except Exception as ex:
            logger.error(f"Failed to generate JPG preview: {ex}")
            return None

    def _normalize_to_bmp(self, input_path):
        """Convert any supported image file to BMP format in /data/normalized."""
        try:
            logger.info(f"Normalizing {input_path} to BMP")
            base_name = os.path.basename(input_path)
            bmp_name = os.path.splitext(base_name)[0] + ".bmp"
            bmp_target = os.path.join(self.normalized_path, bmp_name)

            if input_path.lower().endswith(".cr2"):
                with rawpy.imread(input_path) as raw:
                    rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=True, bright=1.0)
            else:
                img = cv2.imread(input_path)
                if img is None:
                    logger.error(f"Failed to read image with OpenCV: {input_path}")
                    return None
                rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Save as BMP using OpenCV (expects BGR)
            bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            success = cv2.imwrite(bmp_target, bgr)
            if not success:
                logger.error(f"Failed to write BMP to {bmp_target}")
                return None
            
            logger.info(f"Generated normalized BMP at: {bmp_target}")
            return bmp_target
        except Exception as ex:
            logger.error(f"Failed to normalize to BMP: {ex}")
            return None

    def capture_preview(self):
        with self._lock:
            if not self._ensure_connected():
                return None
            try:
                camera_file = self.camera.capture_preview()
                target = os.path.join(self.previews_path, "live_preview.jpg")
                camera_file.save(target)
                return target
            except gp.GPhoto2Error as ex:
                logger.error(f"Failed to capture preview: {ex}")
                # Connection may be stale, release it
                self._release()
                return None

    def get_config(self, name):
        with self._lock:
            if not self._ensure_connected():
                return None
            try:
                config = self.camera.get_config()
                child = config.get_child_by_name(name)
                return child.get_value()
            except gp.GPhoto2Error as ex:
                logger.error(f"Failed to get config {name}: {ex}")
                return None

    def set_config(self, name, value):
        with self._lock:
            if not self._ensure_connected():
                return False
            try:
                config = self.camera.get_config()
                child = config.get_child_by_name(name)
                child.set_value(value)
                self.camera.set_config(config)
                return True
            except gp.GPhoto2Error as ex:
                logger.error(f"Failed to set config {name} to {value}: {ex}")
                return False

    def close(self):
        with self._lock:
            self._release()
            logger.info("Camera connection closed")
