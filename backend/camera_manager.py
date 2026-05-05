import gphoto2 as gp
import os
import time
import logging
import rawpy
import cv2
import numpy as np
import threading

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

class CameraManager:
    def __init__(self, base_data_path="/data"):
        self.camera = None
        self.base_data_path = base_data_path
        self._lock = threading.Lock()
        
        self.session_date = None
        self.session_folder = None
        self.storage_path = None
        self.previews_path = None
        self.normalized_path = None
        
    def _ensure_session_directories(self):
        now = time.localtime()
        date_str = time.strftime("%Y_%m_%d", now)
        if self.session_date != date_str:
            self.session_date = date_str
            
            base = os.path.join(self.base_data_path, self.session_date)
            self.storage_path = os.path.join(base, "raw")
            self.previews_path = os.path.join(base, "previews")
            
            os.makedirs(self.storage_path, exist_ok=True)
            os.makedirs(self.previews_path, exist_ok=True)

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
            self._ensure_session_directories()
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
                    
                    if target.lower().endswith(".cr2"):
                        try:
                            logger.info(f"Converting {target} native raw to .png...")
                            with rawpy.imread(target) as raw:
                                rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=False, bright=1.0)
                                bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                                png_target = os.path.splitext(target)[0] + ".png"
                                cv2.imwrite(png_target, bgr)
                            # os.remove(target)  <-- Keep original RAW
                            target = png_target
                            logger.info(f"Successfully transcoded to {target}")
                        except Exception as e:
                            logger.error(f"Failed converting CR2 to PNG: {e}")
                    else:
                        try:
                            # Also ensure JPGs are saved as PNG
                            logger.info(f"Converting native JPG to .png...")
                            img = cv2.imread(target)
                            if img is not None:
                                png_target = os.path.splitext(target)[0] + ".png"
                                cv2.imwrite(png_target, img)
                                # os.remove(target) <-- Keep original JPG
                                target = png_target
                                logger.info(f"Successfully transcoded to {target}")
                        except Exception as e:
                            logger.error(f"Failed converting format to PNG: {e}")
                            
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



    def capture_preview(self):
        with self._lock:
            self._ensure_session_directories()
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
                child.set_value(str(value))
                self.camera.set_config(config)
                return True
            except gp.GPhoto2Error as ex:
                logger.error(f"Failed to set config {name} to {value}: {ex}")
                return False

    def get_config_options(self, name):
        with self._lock:
            if not self._ensure_connected():
                return []
            try:
                config = self.camera.get_config()
                child = config.get_child_by_name(name)
                return [str(c) for c in child.get_choices()]
            except Exception as e:
                logger.error(f"Failed to get options for {name}: {e}")
                return []

    def auto_probe_exposure(self):
        """Try to find optimal exposure by seeking most even color distribution (histogram)."""
        # 1. Get available options
        iso_options = self.get_config_options("iso")
        ss_options = self.get_config_options("shutterspeed")
        if not iso_options or not ss_options:
            return False

        # Start with highest ISO as requested
        current_iso_idx = len(iso_options) - 1
        
        best_overall_ss = ss_options[0]
        best_overall_iso = iso_options[current_iso_idx]
        best_overall_score = -float('inf')

        while current_iso_idx >= 0:
            target_iso = iso_options[current_iso_idx]
            self.set_config("iso", target_iso)
            logger.info(f"Probing with ISO {target_iso}...")

            best_ss = ss_options[len(ss_options)//2] 
            best_score = -float('inf')
            best_is_overexposed = False
            
            # Sampling shutterspeeds (subset for performance)
            step = max(1, len(ss_options) // 10)
            samples = list(range(0, len(ss_options), step))
            if (len(ss_options)-1) not in samples:
                samples.append(len(ss_options)-1)
            
            for idx in samples:
                ss = ss_options[idx]
                self.set_config("shutterspeed", ss)
                time.sleep(0.1)
                preview_path = self.capture_preview()
                if not preview_path: continue
                
                img = cv2.imread(preview_path)
                if img is None: continue
                
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                median = np.median(gray)
                std = np.std(gray)
                clipped_low = np.sum(gray <= 5) / gray.size
                clipped_high = np.sum(gray >= 250) / gray.size
                
                # Check for extreme overexposure
                is_overexposed = clipped_high > 0.1 or median > 200
                
                score = (std * 0.5) - abs(median - 128) - (clipped_low * 200) - (clipped_high * 200)
                logger.info(f"Probing ISO {target_iso} SS {ss}: Median {median:.1f}, Clip H {clipped_high:.1%}, Score {score:.1f}")
                
                if score > best_score:
                    best_score = score
                    best_ss = ss
                    best_is_overexposed = is_overexposed

            # Update overall best
            if best_score > best_overall_score:
                best_overall_score = best_score
                best_overall_ss = best_ss
                best_overall_iso = target_iso

            # If the best result at this ISO is still too bright, try a lower ISO
            if best_is_overexposed and current_iso_idx > 0:
                logger.info(f"ISO {target_iso} is too bright even at best SS. Stepping down ISO.")
                current_iso_idx -= 1
                continue
            else:
                # Found a good balance or cannot improve further
                break

        # Final set
        self.set_config("iso", best_overall_iso)
        self.set_config("shutterspeed", best_overall_ss)
        logger.info(f"Auto-probe finished. Best: {best_overall_ss} at ISO {best_overall_iso} (Score: {best_overall_score:.1f})")
        return {"iso": best_overall_iso, "shutterspeed": best_overall_ss}

    def close(self):
        with self._lock:
            self._release()
            logger.info("Camera connection closed")
