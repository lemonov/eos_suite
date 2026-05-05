import subprocess
import os
import shutil
import logging
import uuid

logger = logging.getLogger(__name__)

class FocusStacker:
    def __init__(self, temp_dir="/tmp/stacking", output_dir="/data/processed"):
        self.temp_dir = temp_dir
        self.output_dir = output_dir
        if not os.path.exists(self.temp_dir):
            os.makedirs(self.temp_dir)
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def stack(self, image_paths, output_filename, flags=None):
        """
        image_paths: list of base image paths to stack.
        output_filename: name of the final stacked image.
        flags: list of extra command line flags (e.g. ["--no-contrast"])
        Returns (success, result_path, log_output)
        """
        if not image_paths:
            logger.error("No images provided for stacking")
            return False, None, "No images provided"

        # 1. Create a workspace for this stack
        stack_id = str(uuid.uuid4())
        workspace = os.path.join(self.temp_dir, stack_id)
        if not os.path.exists(workspace):
            os.makedirs(workspace)

        try:
            # 2. Process images (prefer original RAW if available for better quality)
            processed_paths = []
            for path in image_paths:
                # If path is a .png, check if a .cr2 sibling exists
                base_no_ext = os.path.splitext(path)[0]
                cr2_path = base_no_ext + ".cr2"
                
                final_input_path = path
                if os.path.exists(cr2_path):
                    final_input_path = cr2_path

                if final_input_path.lower().endswith((".cr2", ".dng")):
                    import rawpy
                    import imageio
                    
                    tiff_name = os.path.splitext(os.path.basename(final_input_path))[0] + ".tiff"
                    tiff_path = os.path.join(workspace, tiff_name)
                    
                    logger.info(f"Converting {final_input_path} to 16-bit TIFF for stacking...")
                    with rawpy.imread(final_input_path) as raw:
                        # Use high-quality 16-bit output for stacking
                        rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=True, bright=1.0, output_bps=16)
                        imageio.imsave(tiff_path, rgb)
                    processed_paths.append(tiff_path)
                else:
                    processed_paths.append(final_input_path)

            # 3. Run focus-stack
            logger.info(f"Running focus-stack on {len(processed_paths)} images...")
            
            # Match output extension with first input extension if it's common
            ext = os.path.splitext(image_paths[0])[1].lower() if image_paths else ".png"
            if ext not in [".png", ".jpg", ".jpeg", ".tiff", ".tif"]:
                ext = ".png"
                
            if not output_filename.lower().endswith(ext):
                output_filename = os.path.splitext(output_filename)[0] + ext
            
            output_path = os.path.join(self.output_dir, output_filename)
            
            stack_cmd = [
                "focus-stack",
                "--output=" + output_path,
                "--verbose"
            ]
            if flags:
                stack_cmd.extend(flags)
            
            stack_cmd.extend(processed_paths)
            
            logger.info(f"Executing: {' '.join(stack_cmd)}")
            result = subprocess.run(stack_cmd, capture_output=True, text=True)
            
            log_output = f"COMMAND:\n{' '.join(stack_cmd)}\n\nSTDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
            
            if result.returncode != 0:
                logger.error(f"focus-stack failed: {result.stderr}")
                return False, None, log_output

            logger.info(f"Stacking complete: {output_path}")
            return True, output_path, log_output

        except Exception as ex:
            error_msg = f"Stacking failed with unexpected error: {ex}"
            logger.error(error_msg)
            return False, None, error_msg
        finally:
            # focus-stack is efficient and doesn't leave large intermediate files
            # in the same way align_image_stack + enfuse did, but we still clean up the workspace
            try:
                shutil.rmtree(workspace)
                logger.debug(f"Cleaned up workspace {workspace}")
            except Exception as e:
                logger.warning(f"Failed to clean up workspace {workspace}: {e}")
