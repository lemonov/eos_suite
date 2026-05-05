from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import List
import asyncio
import os
import shutil
import uuid
from PIL import Image
import logging
import time
import base64
from io import BytesIO

active_client_id = None
last_ping_time = 0

from camera_manager import CameraManager
from stacker import FocusStacker

logging.basicConfig(level=logging.WARNING)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DATA_PATH = "/data"
BASE_THUMB_CACHE = os.path.join(BASE_DATA_PATH, ".cache", "thumbnails")

# Initialize managers
camera = CameraManager(base_data_path=BASE_DATA_PATH)
stacker = FocusStacker(output_dir=BASE_DATA_PATH) # Will be dynamically overridden per request

if not os.path.exists(BASE_DATA_PATH):
    os.makedirs(BASE_DATA_PATH)
if not os.path.exists(BASE_THUMB_CACHE):
    os.makedirs(BASE_THUMB_CACHE, exist_ok=True)

app.mount("/data_files", CORSStaticFiles(directory=BASE_DATA_PATH), name="data_files")

class StackRequest(BaseModel):
    image_names: List[str] # Now relative paths like 2026_04_06/12_05_30/raw/IMG_xxx.cr2
    output_name: str
    flags: List[str] = []

@app.get("/")
async def root():
    return {"message": "EOS Focus Stacking Suite API"}

@app.post("/health/ping")
async def ping(client_id: str = Body(embed=True)):
    global active_client_id, last_ping_time
    now = time.time()
    
    # If there is an active client and it pinged recently, and this is a different client
    if active_client_id and active_client_id != client_id and (now - last_ping_time < 5):
        raise HTTPException(status_code=409, detail="Another client is currently active")
        
    active_client_id = client_id
    last_ping_time = now
    return {"status": "ok"}

async def camera_idle_task():
    global last_ping_time
    while True:
        await asyncio.sleep(5)
        # If no client has pinged in 10 seconds, close the camera to release USB lock
        if time.time() - last_ping_time > 10 and last_ping_time > 0:
            logger.info("No active clients detected, suspending camera connection...")
            await asyncio.to_thread(camera.close)
            last_ping_time = 0 # reset so we don't spam close
            
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(camera_idle_task())

@app.get("/camera/status")
async def camera_status():
    connected = await asyncio.to_thread(camera.connect)
    return {"connected": connected}

@app.get("/camera/preview")
async def camera_preview():
    path = await asyncio.to_thread(camera.capture_preview)
    if path:
        rel_path = os.path.relpath(path, BASE_DATA_PATH)
        return {"url": f"/data_files/{rel_path}?t={int(time.time()*1000)}"}
    raise HTTPException(status_code=500, detail="Preview failed")

@app.get("/camera/stream")
async def camera_stream(request: Request):
    async def frame_generator():
        while True:
            if await request.is_disconnected():
                break
            
            path = await asyncio.to_thread(camera.capture_preview)
            if path:
                try:
                    with open(path, "rb") as f:
                        image_data = f.read()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + image_data + b'\r\n')
                except Exception as e:
                    logger.error(f"Error reading preview file: {e}")
            
            await asyncio.sleep(0.05)

    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.post("/camera/capture")
async def capture():
    path = await asyncio.to_thread(camera.capture_image)
    if path:
        rel_path = os.path.relpath(path, BASE_DATA_PATH)
        return {"filename": rel_path, "url": f"/data_files/{rel_path}"}
    raise HTTPException(status_code=500, detail="Capture failed")

@app.post("/camera/probe")
async def probe_exposure():
    result = await asyncio.to_thread(camera.auto_probe_exposure)
    if result:
        return result
    raise HTTPException(status_code=500, detail="Exposure probe failed")

@app.get("/images")
async def list_images():
    raw_list = []
    stacked_list = []
    canvas_list = []
    
    def get_dims(path):
        try:
            with Image.open(path) as img:
                return img.width, img.height
        except:
            return 1920, 1080

    for root, dirs, files in os.walk(BASE_DATA_PATH):
        # Prune hidden directories in-place (like .cache, .thumbnails) from the walk
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        # Sort files by modification time descending
        files_with_mtime = [(f, os.path.getmtime(os.path.join(root, f))) for f in files]
        files_with_mtime.sort(key=lambda x: x[1], reverse=True)
        
        for f, mtime in files_with_mtime:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, BASE_DATA_PATH) 
            parts = rel_path.split(os.sep)
            
            if len(parts) >= 3:
                session_group = parts[0]  # Just the date (YYYY_MM_DD)
                folder_type = parts[-2]
            elif len(parts) == 2:
                session_group = "Legacy"
                folder_type = parts[0]
            else:
                continue

            if folder_type not in ["raw", "processed"]:
                continue
            
            if f.lower().endswith(".cr2"):
                continue
            
            mtime_int = int(mtime)
            
            if folder_type == "raw":
                w, h = get_dims(full_path)
                img_info = {
                    "name": rel_path,
                    "url": f"/data_files/{rel_path}",
                    "thumb_url": f"/images/thumb/{rel_path}",
                    "type": folder_type,
                    "session": session_group,
                    "width": w,
                    "height": h
                }
                raw_list.append(img_info)

            elif folder_type == "processed":
                w, h = get_dims(full_path)
                if f.startswith("stack_"):
                    stacked_list.append({
                        "name": rel_path, 
                        "url": f"/data_files/{rel_path}?t={mtime_int}", 
                        "width": w, "height": h, 
                        "type": "stacked",
                        "session": session_group
                    })
                else:
                    canvas_list.append({
                        "name": rel_path, 
                        "url": f"/data_files/{rel_path}?t={mtime_int}", 
                        "width": w, "height": h, 
                        "type": "processed",
                        "session": session_group
                    })

    # Sort all globally
    # They are already sorted per dir, but we must sort the flattened lists
    def extract_time(url):
        try:
            return int(url.split("?t=")[1])
        except:
            return 0
    
    raw_list.sort(key=lambda x: extract_time(x["url"]), reverse=True)
    stacked_list.sort(key=lambda x: extract_time(x["url"]), reverse=True)
    canvas_list.sort(key=lambda x: extract_time(x["url"]), reverse=True)

    return {
        "raw": raw_list,
        "stacked": stacked_list,
        "processed": canvas_list
    }

@app.delete("/images/{filepath:path}")
async def delete_image(filepath: str):
    full_path = os.path.join(BASE_DATA_PATH, filepath)
    if os.path.exists(full_path):
        os.remove(full_path)
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Image not found")

@app.post("/images/duplicate/{filepath:path}")
async def duplicate_image(filepath: str):
    full_path = os.path.join(BASE_DATA_PATH, filepath)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    base_name = os.path.basename(full_path)
    name_no_ext, ext = os.path.splitext(base_name)
    parent_dir = os.path.dirname(full_path)
    
    counter = 1
    while True:
        new_name = f"{name_no_ext}_copy{counter}{ext}"
        new_path = os.path.join(parent_dir, new_name)
        if not os.path.exists(new_path):
            break
        counter += 1
    
    shutil.copy2(full_path, new_path)
    rel_path = os.path.relpath(new_path, BASE_DATA_PATH)
    return {"status": "ok", "filename": rel_path, "url": f"/data_files/{rel_path}"}

@app.post("/images/overwrite/{filepath:path}")
async def overwrite_image(filepath: str, data: dict = Body(...)):
    full_path = os.path.join(BASE_DATA_PATH, filepath)
    
    image_data = data.get("image")
    if not image_data or "," not in image_data:
        raise HTTPException(status_code=400, detail="Invalid image data")

    try:
        header, encoded = image_data.split(",", 1)
        decoded = base64.b64decode(encoded)
        
        img = Image.open(BytesIO(decoded))
        
        base_name = os.path.basename(full_path)
        
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        ext = os.path.splitext(base_name)[1].lower()
        if ext in ['.png', '.bmp']:
            fmt = "PNG"
        elif ext in ['.jpg', '.jpeg']:
            fmt = "JPEG"
        else:
            fmt = "PNG"
            
        if fmt == "JPEG" and img.mode == 'RGBA':
            img = img.convert('RGB')
        
        img.save(full_path, fmt)

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Overwrite failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/canvas/save")
async def save_canvas(data: dict = Body(...)):
    image_data = data.get("image")
    if not image_data or "," not in image_data:
        raise HTTPException(status_code=400, detail="Invalid image data")
        
    try:
        header, encoded = image_data.split(",", 1)
        decoded = base64.b64decode(encoded)
        
        session_date = camera.session_date or time.strftime("%Y_%m_%d")
        session_folder = camera.session_folder or time.strftime("%H_%M_%S")
        processed_dir = os.path.join(BASE_DATA_PATH, session_date, session_folder, "processed")
        os.makedirs(processed_dir, exist_ok=True)
        
        filename = f"canvas_{int(time.time())}.png"
        full_path = os.path.join(processed_dir, filename)
        
        img = Image.open(BytesIO(decoded))
        img.save(full_path, "PNG")
        
        rel_path = os.path.relpath(full_path, BASE_DATA_PATH)
        return {"status": "ok", "filename": rel_path, "url": f"/data_files/{rel_path}"}
    except Exception as e:
        logger.error(f"Canvas save failed with exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def generate_thumb(full_path, thumb_path):
    with Image.open(full_path) as img:
        # Maintain aspect ratio, max width 400
        w, h = img.size
        new_w = 400
        new_h = int(h * (new_w / w))
        img.thumbnail((new_w, new_h))
        # Convert RGBA to RGB if needed for JPEG
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(thumb_path, "JPEG", quality=85)

@app.get("/images/thumb/{filepath:path}")
async def get_thumbnail(filepath: str):
    full_path = os.path.join(BASE_DATA_PATH, filepath)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Original image not found")
    
    thumb_path = os.path.join(BASE_THUMB_CACHE, filepath)
    # Ensure JPEG for thumbs
    thumb_path = os.path.splitext(thumb_path)[0] + ".jpg"
    
    # Run a quick check on cache size occasionally (e.g. 1% of requests)
    import random
    if random.random() < 0.01:
        asyncio.create_task(cleanup_thumbnails())
        
    if not os.path.exists(thumb_path):
        try:
            os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
            await asyncio.to_thread(generate_thumb, full_path, thumb_path)
        except Exception as e:
            logger.error(f"Thumbnail generation failed: {e}")
            raise HTTPException(status_code=500, detail="Thumbnail creation failed")

    from starlette.responses import FileResponse
    return FileResponse(thumb_path)

@app.post("/images/thumb/clear")
async def clear_thumbnail_cache():
    try:
        if os.path.exists(BASE_THUMB_CACHE):
            shutil.rmtree(BASE_THUMB_CACHE)
            os.makedirs(BASE_THUMB_CACHE, exist_ok=True)
        return {"status": "ok", "message": "Thumbnail cache cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def cleanup_thumbnails(max_size_mb: int = 500):
    """Prune oldest thumbnails if cache exceeds max_size_mb."""
    if not os.path.exists(BASE_THUMB_CACHE):
        return
        
    try:
        # Get all thumbnails with their sizes and access/mod times
        thumbs = []
        total_size = 0
        for root, dirs, files in os.walk(BASE_THUMB_CACHE):
            for f in files:
                p = os.path.join(root, f)
                stat = os.stat(p)
                thumbs.append({
                    "path": p,
                    "size": stat.st_size,
                    "time": stat.st_mtime
                })
                total_size += stat.st_size
        
        # If over limit, sort by time and delete oldest
        if total_size > max_size_mb * 1024 * 1024:
            thumbs.sort(key=lambda x: x["time"])
            target_to_delete = total_size - (max_size_mb * 0.8 * 1024 * 1024) # Shrink to 80% to avoid immediate thrashing
            deleted_size = 0
            for t in thumbs:
                try:
                    os.remove(t["path"])
                    deleted_size += t["size"]
                    if deleted_size >= target_to_delete:
                        break
                except:
                    continue
            logger.info(f"Thumbnail cleanup finished. Deleted {deleted_size / (1024*1024):.1f} MB.")
    except Exception as e:
        logger.error(f"Error during thumbnail cleanup: {e}")

class BatchStackRequest(BaseModel):
    groups: list[list[str]]
    output_names: list[str]
    flags: dict = {}

@app.post("/stack/batch")
async def focus_stack_batch(request: BatchStackRequest):
    results = []
    errors = []
    
    for idx, image_names in enumerate(request.groups):
        try:
            input_paths = [os.path.join(BASE_DATA_PATH, name) for name in image_names]
            for p in input_paths:
                if not os.path.exists(p):
                    raise ValueError(f"Image not found: {p}")
            
            output_name = request.output_names[idx] if idx < len(request.output_names) else f"batch_stack_{int(time.time())}_{idx}.tif"
            
            if len(input_paths) > 0:
                parent_dir = os.path.dirname(os.path.dirname(input_paths[0]))
                processed_dir = os.path.join(parent_dir, "processed")
                os.makedirs(processed_dir, exist_ok=True)
                stacker.output_dir = processed_dir
            else:
                stacker.output_dir = os.path.join(BASE_DATA_PATH, "processed")
                os.makedirs(stacker.output_dir, exist_ok=True)
                
            success, output_path, logs = await asyncio.to_thread(stacker.stack, input_paths, output_name, request.flags)
            
            if success and output_path:
                rel_path = os.path.relpath(output_path, BASE_DATA_PATH)
                results.append({
                    "filename": rel_path,
                    "url": f"/data_files/{rel_path}"
                })
            else:
                errors.append(f"Stack {idx} failed")
        except Exception as e:
            errors.append(f"Stack {idx} error: {str(e)}")
            
    return {"status": "complete", "results": results, "errors": errors}

@app.post("/stack")
async def focus_stack(request: StackRequest):
    input_paths = [os.path.join(BASE_DATA_PATH, name) for name in request.image_names]
    for p in input_paths:
        if not os.path.exists(p):
            raise HTTPException(status_code=404, detail=f"Image not found: {p}")
            
    # Save into the same session folder as the first image
    if len(request.image_names) > 0:
        parent_dir = os.path.dirname(os.path.dirname(input_paths[0]))
        processed_dir = os.path.join(parent_dir, "processed")
        os.makedirs(processed_dir, exist_ok=True)
        stacker.output_dir = processed_dir
    else:
        # Fallback
        stacker.output_dir = os.path.join(BASE_DATA_PATH, "processed")
        os.makedirs(stacker.output_dir, exist_ok=True)
    
    success, output_path, logs = await asyncio.to_thread(stacker.stack, input_paths, request.output_name, request.flags)
    
    if success and output_path:
        rel_path = os.path.relpath(output_path, BASE_DATA_PATH)
        return {
            "status": "ok",
            "filename": rel_path, 
            "url": f"/data_files/{rel_path}",
            "logs": logs
        }
    
    raise HTTPException(status_code=500, detail={
        "message": "Stacking failed",
        "logs": logs
    })

@app.get("/camera/config/{name}")
async def get_camera_config(name: str):
    value = await asyncio.to_thread(camera.get_config, name)
    if value is not None:
        return {"name": name, "value": value}
    raise HTTPException(status_code=404, detail="Config not found")

@app.post("/camera/config/{name}")
async def set_camera_config(name: str, data: dict = Body(...)):
    success = await asyncio.to_thread(camera.set_config, name, data.get("value"))
    if success:
        return {"status": "ok"}
    raise HTTPException(status_code=500, detail=f"Failed to set config {name}")

@app.get("/camera/options/{name}")
async def get_camera_options(name: str):
    options = await asyncio.to_thread(camera.get_config_options, name)
    return {"options": options}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
