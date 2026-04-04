from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from pydantic import BaseModel
from typing import List
import os
import uuid
from PIL import Image
import logging
import time
import base64
from io import BytesIO

from camera_manager import CameraManager
from stacker import FocusStacker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="EOS Focus Stacking Suite")

class CORSStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope) -> Response:
        try:
            response = await super().get_response(path, scope)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "*"
            return response
        except Exception as e:
            logger.error(f"Error serving static file {path}: {e}")
            raise e

# CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
RAW_DATA_PATH = "/data/raw"
PROCESSED_DATA_PATH = "/data/processed"
NORMALIZED_DATA_PATH = "/data/normalized"
PREVIEWS_DATA_PATH = "/data/previews"

# Initialize managers
camera = CameraManager(storage_path=RAW_DATA_PATH)
stacker = FocusStacker(output_dir=PROCESSED_DATA_PATH)

# Serve static files
if not os.path.exists(RAW_DATA_PATH):
    os.makedirs(RAW_DATA_PATH)
if not os.path.exists(PROCESSED_DATA_PATH):
    os.makedirs(PROCESSED_DATA_PATH)

if not os.path.exists(NORMALIZED_DATA_PATH):
    os.makedirs(NORMALIZED_DATA_PATH)

app.mount("/raw", CORSStaticFiles(directory=RAW_DATA_PATH), name="raw")
app.mount("/processed", CORSStaticFiles(directory=PROCESSED_DATA_PATH), name="processed")
app.mount("/previews", CORSStaticFiles(directory=PREVIEWS_DATA_PATH), name="previews")
app.mount("/normalized", CORSStaticFiles(directory=NORMALIZED_DATA_PATH), name="normalized")

class StackRequest(BaseModel):
    image_names: List[str]
    output_name: str
    flags: List[str] = []

@app.get("/")
async def root():
    return {"message": "EOS Focus Stacking Suite API"}

@app.get("/camera/status")
async def camera_status():
    connected = camera.connect()
    return {"connected": connected}

@app.get("/camera/preview")
async def camera_preview():
    path = camera.capture_preview()
    if path:
        return {"url": f"/previews/{os.path.basename(path)}?t={int(time.time()*1000)}"}
    raise HTTPException(status_code=500, detail="Preview failed")

@app.post("/camera/capture")
async def capture():
    path = camera.capture_image()
    if path:
        filename = os.path.basename(path)
        result = {"filename": filename, "url": f"/raw/{filename}"}
        # Add normalized BMP URL
        bmp_name = os.path.splitext(filename)[0] + ".bmp"
        result["normalized_url"] = f"/normalized/{bmp_name}"
        
        if filename.lower().endswith(".cr2"):
            preview_name = os.path.splitext(filename)[0] + ".jpg"
            result["preview_url"] = f"/previews/{preview_name}"
        return result
    raise HTTPException(status_code=500, detail="Capture failed")

@app.get("/images")
async def list_images():
    raw_files = sorted([f for f in os.listdir(RAW_DATA_PATH) if os.path.isfile(os.path.join(RAW_DATA_PATH, f))], reverse=True)
    processed_all = sorted([f for f in os.listdir(PROCESSED_DATA_PATH) if os.path.isfile(os.path.join(PROCESSED_DATA_PATH, f))], reverse=True)
    
    # Categorize processed images
    stacked_files = [f for f in processed_all if f.startswith("stack_")]
    canvas_files = [f for f in processed_all if not f.startswith("stack_")]

    def get_dims(path):
        try:
            with Image.open(path) as img:
                return img.width, img.height
        except:
            return 1920, 1080 # Fallback

    raw_list = []
    for f in raw_files:
        full_path = os.path.join(RAW_DATA_PATH, f)
        img_info = {"name": f, "url": f"/raw/{f}", "width": 0, "height": 0}
        
        if f.lower().endswith(".cr2"):
            preview_name = os.path.splitext(f)[0] + ".jpg"
            preview_path = os.path.join(PREVIEWS_DATA_PATH, preview_name)
            if os.path.exists(preview_path):
                img_info["preview_url"] = f"/previews/{preview_name}"
                w, h = get_dims(preview_path)
                img_info["width"], img_info["height"] = w, h
        else:
            w, h = get_dims(full_path)
            img_info["width"], img_info["height"] = w, h
        
        # Check for normalized BMP
        bmp_name = os.path.splitext(f)[0] + ".bmp"
        if os.path.exists(os.path.join(NORMALIZED_DATA_PATH, bmp_name)):
            img_info["normalized_url"] = f"/normalized/{bmp_name}"
            # Use BMP as preview if it exists and no other preview is set
            if "preview_url" not in img_info:
                img_info["preview_url"] = img_info["normalized_url"]
                # Update dims from BMP if still 0
                if img_info["width"] == 0:
                   w, h = get_dims(os.path.join(NORMALIZED_DATA_PATH, bmp_name))
                   img_info["width"], img_info["height"] = w, h
            
        raw_list.append(img_info)
    
    stacked_list = []
    for f in stacked_files:
        full_path = os.path.join(PROCESSED_DATA_PATH, f)
        w, h = get_dims(full_path)
        stacked_list.append({"name": f, "url": f"/processed/{f}", "width": w, "height": h, "type": "stacked"})

    canvas_list = []
    for f in canvas_files:
        full_path = os.path.join(PROCESSED_DATA_PATH, f)
        w, h = get_dims(full_path)
        canvas_list.append({"name": f, "url": f"/processed/{f}", "width": w, "height": h, "type": "processed"})
        
    return {
        "raw": raw_list,
        "stacked": stacked_list,
        "processed": canvas_list
    }

@app.delete("/images/{img_type}/{filename}")
async def delete_image(img_type: str, filename: str):
    if img_type == "raw":
        base_path = RAW_DATA_PATH
    elif img_type in ["processed", "stacked"]:
        base_path = PROCESSED_DATA_PATH
    else:
        raise HTTPException(status_code=400, detail="Invalid image type")
        
    full_path = os.path.join(base_path, filename)
    if os.path.exists(full_path):
        os.remove(full_path)
        # Also remove preview if it exists
        preview_name = os.path.splitext(filename)[0] + ".jpg"
        preview_path = os.path.join(PREVIEWS_DATA_PATH, preview_name)
        if os.path.exists(preview_path):
            os.remove(preview_path)
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Image not found")

@app.post("/canvas/save")
async def save_canvas(data: dict = Body(...)):
    image_data = data.get("image")
    if not image_data or "," not in image_data:
        logger.error("Invalid image data received in save_canvas: missing data header")
        raise HTTPException(status_code=400, detail="Invalid image data")
        
    try:
        header, encoded = image_data.split(",", 1)
        logger.info(f"Received canvas save request: Header: {header}, Data length: {len(encoded)} bytes")
        decoded = base64.b64decode(encoded)
        
        filename = f"canvas_{int(time.time())}.bmp"
        full_path = os.path.join(PROCESSED_DATA_PATH, filename)
        
        logger.info(f"Saving canvas to {full_path}")
        # Use PIL to save as BMP for reliability
        img = Image.open(BytesIO(decoded))
        img.save(full_path, "BMP")
        logger.info(f"Canvas save successful: {filename} ({img.width}x{img.height})")
            
        return {"status": "ok", "filename": filename, "url": f"/processed/{filename}"}
    except Exception as e:
        logger.error(f"Canvas save failed with exception: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stack")
async def focus_stack(request: StackRequest):
    input_paths = [os.path.join(RAW_DATA_PATH, name) for name in request.image_names]
    # Check if files exist
    for p in input_paths:
        if not os.path.exists(p):
            raise HTTPException(status_code=404, detail=f"Image not found: {os.path.basename(p)}")
    
    success, output_path, logs = stacker.stack(input_paths, request.output_name, request.flags)
    
    if success and output_path:
        return {
            "status": "ok",
            "filename": os.path.basename(output_path), 
            "url": f"/processed/{os.path.basename(output_path)}",
            "logs": logs
        }
    
    # If failed, return logs in the error detail
    raise HTTPException(status_code=500, detail={
        "message": "Stacking failed",
        "logs": logs
    })

@app.get("/camera/config/{name}")
async def get_camera_config(name: str):
    value = camera.get_config(name)
    if value is not None:
        return {"name": name, "value": value}
    raise HTTPException(status_code=404, detail="Config not found or camera disconnected")

@app.post("/camera/config/{name}")
async def set_camera_config(name: str, value: str = Body(..., embed=True)):
    success = camera.set_config(name, value)
    if success:
        return {"status": "ok"}
    raise HTTPException(status_code=500, detail="Failed to set config")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
