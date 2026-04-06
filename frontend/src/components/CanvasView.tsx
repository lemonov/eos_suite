"use client";

import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import { Layout, MousePointer2, Plus, Download, Trash2, Layers, Sliders, FlipHorizontal, FlipVertical, Image as ImageIcon, Maximize2, Minimize2, Save, Upload } from "lucide-react";
import { useCanvas, type CanvasImage } from "@/context/CanvasContext";

const API_BASE = "http://localhost:8000";

// Interface moved to CanvasContext.tsx

interface URLImageProps {
  image: CanvasImage;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: CanvasImage) => void;
}

// Individual Image Component with Transformer
const URLImage = ({ image, isSelected, onSelect, onChange }: URLImageProps) => {
  const [img, status] = useImage(image.url, "anonymous");
  
  useEffect(() => {
    if (status === 'failed') {
      console.error("Failed to load image for canvas:", image.url);
    }
  }, [status, image.url]);

  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        image={img}
        x={image.x + image.width / 2}
        y={image.y + image.height / 2}
        width={image.width}
        height={image.height}
        offsetX={image.width / 2}
        offsetY={image.height / 2}
        opacity={image.opacity}
        scaleX={image.scaleX || 1}
        scaleY={image.scaleY || 1}
        globalCompositeOperation={image.blendMode as any}
        draggable
        ref={shapeRef}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...image,
            x: e.target.x() - image.width / 2,
            y: e.target.y() - image.height / 2,
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          
          const newWidth = Math.max(5, node.width() * scaleX);
          const newHeight = Math.max(5, node.height() * scaleY);
          
          onChange({
            ...image,
            x: node.x() - newWidth / 2,
            y: node.y() - newHeight / 2,
            width: newWidth,
            height: newHeight,
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

interface CanvasViewProps {
  images: {
    raw: any[];
    processed: any[];
    stacked: any[];
  }
}

export default function CanvasView({ images }: CanvasViewProps) {
  const { 
    canvasImages, 
    setCanvasImages, 
    selectedId, 
    setSelectedId, 
    updateImage, 
    handleBringToFront, 
    handleSendToBack 
  } = useCanvas();

  const [isSaving, setIsSaving] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<any | null>(null);
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProject = () => {
    const data = JSON.stringify(canvasImages, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `project_${Date.now()}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Clear input so same file can be loaded again if needed
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as CanvasImage[];
        
        let anyMissing = false;
        // Verify all image URLs exist across the array
        await Promise.all(data.map(async (img) => {
           try {
             const res = await fetch(img.url, { method: "HEAD" });
             if (!res.ok) anyMissing = true;
           } catch {
             anyMissing = true;
           }
        }));
        
        if (anyMissing) {
          alert("Warning: Some images from the project may be missing on the server and could fail to load.");
        }
        
        setCanvasImages(data);
        setSelectedId(null);
      } catch (err) {
        alert("Failed to load project: invalid format");
      }
    };
    reader.readAsText(file);
  };

  const handleAddImage = (img: any) => {
    const newImg: CanvasImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: img.name,
      url: `${API_BASE}${img.normalized_url || img.preview_url || img.url}`,
      x: 50 + canvasImages.length * 20,
      y: 50 + canvasImages.length * 20,
      width: (img.width && img.width > 0) ? img.width / 4 : 400,
      height: (img.height && img.height > 0) ? img.height / 4 : 300,
      opacity: 1,
      blendMode: "source-over",
      scaleX: 1,
      scaleY: 1
    };
    setCanvasImages(prev => [...prev, newImg]);
  };

  const getCompositionBounds = () => {
    if (canvasImages.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    canvasImages.forEach(img => {
      minX = Math.min(minX, img.x);
      minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + img.width);
      maxY = Math.max(maxY, img.y + img.height);
    });

    // Add some padding
    const padding = 20;
    return {
      x: minX - padding,
      y: minY - padding,
      width: (maxX - minX) + padding * 2,
      height: (maxY - minY) + padding * 2
    };
  };

  const handleExport = () => {
    if (!stageRef.current) return;
    const bounds = getCompositionBounds();
    const uri = stageRef.current.toDataURL(bounds ? { ...bounds, pixelRatio: 2 } : { pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `stitched_composite_${Date.now()}.png`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToGallery = async () => {
    if (!stageRef.current) return;
    setIsSaving(true);
    console.log("Starting canvas export...");
    try {
      const bounds = getCompositionBounds();
      const uri = stageRef.current.toDataURL(bounds ? { ...bounds, pixelRatio: 2 } : { pixelRatio: 2 });
      console.log("Canvas exported to DataURL, sending to backend...");
      const res = await fetch(`${API_BASE}/canvas/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uri })
      });
      if (res.ok) {
        const result = await res.json();
        console.log("Canvas saved successfully:", result);
        alert("\u2705 Composition saved to gallery!");
      } else {
        const error = await res.json();
        console.error("Canvas save failed on backend:", error);
        alert("\u274C Save failed: " + (error.detail || "Server error"));
      }
    } catch (e) {
      console.error("Canvas export/save failed with exception:", e);
      alert("Save failed: " + (e as any).message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedImage = canvasImages.find(i => i.id === selectedId);

  return (
    <div className="flex h-full overflow-hidden bg-[#1a1a1a]">
      {/* Asset Panel */}
      <div className="w-64 shrink-0 border-r border-dark-border bg-dark-sidebar flex flex-col p-4">
        <h3 className="sidebar-title flex items-center gap-2 mb-4">
            <Layout size={12} className="text-dark-accent" /> Asset Drawer
        </h3>
        <div className="flex-1 overflow-auto space-y-2 pr-2">
          {images.raw.length === 0 && images.processed.length === 0 && images.stacked.length === 0 && (
            <p className="text-[10px] opacity-20 italic">No images to add.</p>
          )}
          {[
            ...images.raw.map((i:any) => ({...i, type:'raw'})), 
            ...images.stacked.map((i:any) => ({...i, type:'stacked'})), 
            ...images.processed.map((i:any) => ({...i, type:'processed'}))
          ].map((img, idx) => (
            <div 
                key={idx} 
                onClick={() => handleAddImage(img)}
                className="group relative h-36 bg-black/40 border border-white/10 rounded cursor-pointer hover:border-dark-accent transition-all overflow-hidden flex flex-col"
            >
              <div className="relative flex-1 bg-black/20 min-h-0">
                <img src={`${API_BASE}${img.preview_url || img.url}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt={img.name} />
                <div className={`absolute top-1 left-1 px-1 py-0.5 rounded-xs text-[6px] font-bold uppercase z-10 ${img.type === 'raw' ? 'bg-blue-600/80' : img.type === 'stacked' ? 'bg-purple-600/80' : 'bg-green-600/80'}`}>
                  {img.type}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center p-2 transition-opacity gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEnlargedImage(img); }}
                    className="p-1 hover:text-dark-accent text-white"
                    title="Fullscreen Preview"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button className="p-1 hover:text-dark-accent text-white" title="Add to Canvas">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="bg-[#111] p-2 border-t border-white/5 shrink-0">
                 <p className="text-[10px] font-bold text-white/90 truncate leading-tight" title={img.name}>{img.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Canvas Toolbar */}
        <div className="min-h-[40px] py-2 bg-dark-sidebar/40 border-b border-dark-border flex flex-wrap items-center px-4 gap-y-3 gap-x-4">
           <div className="flex items-center gap-2 shrink-0">
              <MousePointer2 size={12} className="text-dark-accent" />
              <span className="text-[10px] uppercase font-bold text-white/40">Select Tool</span>
           </div>

           {/* Selected Image Controls */}
           {selectedImage && (
             <div className="flex flex-wrap items-center gap-3 ml-2 lg:border-l lg:border-white/10 lg:pl-3">
                <button 
                  onClick={() => updateImage(selectedId!, { scaleX: (selectedImage.scaleX || 1) * -1 })}
                  className="text-white/40 hover:text-dark-accent transition-colors" title="Flip Horizontal"
                >
                  <FlipHorizontal size={14} />
                </button>
                <button 
                  onClick={() => updateImage(selectedId!, { scaleY: (selectedImage.scaleY || 1) * -1 })}
                  className="text-white/40 hover:text-dark-accent transition-colors" title="Flip Vertical"
                >
                  <FlipVertical size={14} />
                </button>

                <div className="w-px h-4 bg-white/10 mx-1"></div>

                <button onClick={handleBringToFront} className="flex items-center gap-1 text-[9px] uppercase font-bold text-white/40 hover:text-white transition-colors">
                  <Layers size={12} className="text-dark-accent" /> Front
                </button>
                <button onClick={handleSendToBack} className="flex items-center gap-1 text-[9px] uppercase font-bold text-white/40 hover:text-white transition-colors">
                  <Layers size={12} /> Back
                </button>

                <div className="w-px h-4 bg-white/10 mx-1"></div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase font-bold text-white/40">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedImage.opacity ?? 1}
                    onChange={(e) => updateImage(selectedId!, { opacity: parseFloat(e.target.value) })}
                    className="w-16 h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-[9px] text-dark-accent font-bold w-6 text-right">
                    {Math.round((selectedImage.opacity ?? 1) * 100)}%
                  </span>
                </div>

                <div className="w-px h-4 bg-white/10 mx-1"></div>

                <select
                  value={selectedImage.blendMode}
                  onChange={(e) => updateImage(selectedId!, { blendMode: e.target.value })}
                  className="bg-black/40 border border-white/10 rounded text-[9px] uppercase font-bold text-white/80 h-6 px-1 outline-none"
                >
                  <option value="source-over">Normal</option>
                  <option value="screen">Screen</option>
                  <option value="multiply">Multiply</option>
                  <option value="overlay">Overlay</option>
                  <option value="darken">Darken</option>
                  <option value="lighten">Lighten</option>
                </select>

                <button 
                  onClick={() => {
                    setCanvasImages(prev => prev.filter(i => i.id !== selectedId));
                    setSelectedId(null);
                  }}
                  className="ml-2 text-white/40 hover:text-red-500 transition-colors" title="Remove Layer"
                >
                  <Trash2 size={14} />
                </button>
             </div>
           )}

           <div className="flex flex-wrap gap-2 shrink-0 pl-2 ml-auto">
             <button id="canvas-load-project" onClick={() => fileInputRef.current?.click()} className="dark-button flex gap-2">
                 <Upload size={14} /> Load Project
             </button>
             <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef} 
                onChange={handleLoadProject} 
                style={{ display: 'none' }} 
             />
             <button id="canvas-save-project" onClick={handleSaveProject} className="dark-button flex gap-2">
                 <Save size={14} /> Save Project
             </button>
             
             <button id="canvas-save-btn" onClick={handleSaveToGallery} disabled={isSaving} className="dark-button bg-blue-900/20 text-blue-400 border-blue-500/20 flex gap-2 ml-2">
                <Layers size={14} /> {isSaving ? "Saving..." : "Save to Gallery"}
             </button>
             <button id="canvas-export-btn" onClick={handleExport} className="dark-button flex gap-2">
               <Download size={14} /> Export File
             </button>
           </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#0a0a0a] relative">
          <Stage
            width={2000}
            height={2000}
            ref={stageRef}
            onWheel={(e) => {
              e.evt.preventDefault();
              const stage = stageRef.current;
              if (!stage) return;

              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();
              if (!pointer) return;

              const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
              };

              let direction = e.evt.deltaY > 0 ? -1 : 1;
              if (e.evt.ctrlKey) direction = -direction;

              const scaleBy = 1.1;
              const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

              // Limits
              if (newScale < 0.1 || newScale > 20) return;

              stage.scale({ x: newScale, y: newScale });

              const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
              };
              stage.position(newPos);
              stage.batchDraw();
            }}
            onClick={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
            }}
            onMouseDown={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
            }}
            onTouchStart={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
            }}
          >
            <Layer>
              {canvasImages.map((img) => (
                <URLImage
                  key={img.id}
                  image={img}
                  isSelected={img.id === selectedId}
                  onSelect={() => setSelectedId(img.id)}
                  onChange={(newAttrs) => {
                    updateImage(img.id, newAttrs);
                  }}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setEnlargedImage(null)}
        >
          <button 
            onClick={() => setEnlargedImage(null)}
            className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-3 rounded-full transition-colors z-50"
          >
            <Minimize2 size={24} />
          </button>
          
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center">
            <img 
              src={`${API_BASE}${enlargedImage.normalized_url || enlargedImage.url}`} 
              className="max-w-full max-h-[90vh] object-contain" 
              alt={`Fullscreen ${enlargedImage.name}`}
              onClick={(e) => e.stopPropagation()} 
            />
            <div className="mt-4 px-4 py-2 bg-black/50 rounded flex gap-4 text-xs font-bold items-center sticky bottom-0">
              <span className="opacity-50 text-white">Filename:</span>
              <span className="text-white">{enlargedImage.name}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
