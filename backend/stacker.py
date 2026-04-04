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
            # 2. Process images (convert CR2 to TIFF if needed)
            processed_paths = []
            for path in image_paths:
                if path.lower().endswith(".cr2"):
                    import rawpy
                    import imageio
                    
                    tiff_name = os.path.splitext(os.path.basename(path))[0] + ".tiff"
                    tiff_path = os.path.join(workspace, tiff_name)
                    
                    logger.info(f"Converting {path} to TIFF for stacking...")
                    with rawpy.imread(path) as raw:
                        # Use full quality (no_auto_bright=True to keep exposures consistent)
                        rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=True, bright=1.0)
                        imageio.imsave(tiff_path, rgb)
                    processed_paths.append(tiff_path)
                else:
                    processed_paths.append(path)

            # 3. Run focus-stack
            logger.info(f"Running focus-stack on {len(processed_paths)} images...")
            # Enforce .bmp extension
            if not output_filename.lower().endswith(".bmp"):
                output_filename = os.path.splitext(output_filename)[0] + ".bmp"
            
            output_path = os.path.join(self.output_dir, output_filename)
            
            stack_cmd = [
                "focus-stack",
                "--output=" + output_path,
            ]
            if flags:
                stack_cmd.extend(flags)
            
            stack_cmd.extend(processed_paths)
            
            logger.info(f"Executing: {' '.join(stack_cmd)}")
            result = subprocess.run(stack_cmd, capture_output=True, text=True)
            
            log_output = f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
            
            if result.returncode != 0:
                logger.error(f"focus-stack failed: {result.stderr}")
                return False, None, log_output

            logger.info(f"Stacking complete: {output_path}")
            return True, output_path, log_output

        except Exception as ex:
            logger.error(f"Stacking failed with unexpected error: {ex}")
            return None
        finally:
            # focus-stack is efficient and doesn't leave large intermediate files
            # in the same way align_image_stack + enfuse did, but we still clean up the workspace
            try:
                shutil.rmtree(workspace)
                logger.debug(f"Cleaned up workspace {workspace}")
            except Exception as e:
                logger.warning(f"Failed to clean up workspace {workspace}: {e}")
