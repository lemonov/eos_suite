"use client";

import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Line, Circle } from "react-konva";
import useImage from "use-image";
import { Layout, MousePointer2, Plus, Download, Trash2, Layers, Sliders, FlipHorizontal, FlipVertical, Maximize2, Minimize2, Save, Upload, Eraser, Eye, EyeOff } from "lucide-react";
import { useCanvas, type CanvasImage } from "@/context/CanvasContext";
import PropertiesSidebar from "./stitch/PropertiesSidebar";
import { writePsd } from "ag-psd";

const API_BASE = "http://localhost:8000";

interface URLImageProps {
  image: CanvasImage;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: CanvasImage) => void;
  tool: string;
  commitHistory: () => void;
}

const URLImage = ({ image, isSelected, onSelect, onChange, tool, commitHistory }: URLImageProps) => {
  const [img] = useImage(image.url, "anonymous");
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, tool]);

  return (
    <>
      <Group
        id={`img_${image.id}`}
        draggable={tool === "transform" || tool === "resize"}
        x={image.x + image.width / 2}
        y={image.y + image.height / 2}
        offsetX={image.width / 2}
        offsetY={image.height / 2}
        scaleX={image.scaleX || 1}
        scaleY={image.scaleY || 1}
        rotation={image.rotation || 0}
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        onDragEnd={(e) => {
          const node = e.target;
          onChange({
            ...image,
            x: node.x() - image.width / 2,
            y: node.y() - image.height / 2,
          });
          setTimeout(commitHistory, 0);
        }}
        onTransformEnd={(e) => {
          const node = e.target;
          onChange({
            ...image,
            x: node.x() - image.width / 2,
            y: node.y() - image.height / 2,
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          });
          setTimeout(commitHistory, 0);
        }}
      >
        <KonvaImage
          image={img}
          width={image.width}
          height={image.height}
          opacity={image.opacity}
          globalCompositeOperation={image.blendMode as any}
        />
        {image.maskLines?.map((line: any, i: number) => (
          <Line
            key={i}
            points={line.points}
            stroke="black"
            strokeWidth={line.strokeWidth}
            lineCap="round"
            lineJoin="round"
            tension={0.5}
            globalCompositeOperation="destination-out"
          />
        ))}
      </Group>
      {isSelected && (tool === "transform" || tool === "resize") && (
        <Transformer
          ref={trRef}
          rotateEnabled={tool === "transform"}
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
  const [tool, setTool] = useState<"transform" | "resize" | "eraser">("transform");
  const [eraserRadius, setEraserRadius] = useState<number>(30);
  const [eraserHardness, setEraserHardness] = useState<number>(0.5);
  const [eraserProfile, setEraserProfile] = useState<"linear" | "gaussian">("linear");
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const isDrawing = useRef(false);

  const [history, setHistory] = useState<CanvasImage[][]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);

  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const canvasImagesRef = useRef(canvasImages);
  useEffect(() => {
    canvasImagesRef.current = canvasImages;
  }, [canvasImages]);

  const commitHistory = () => {
    recordHistory(canvasImagesRef.current);
  };

  // Snapshot manager
  const recordHistory = (currentCanvas: CanvasImage[]) => {
    const nextHistory = history.slice(0, historyStep + 1);
    setHistory([...nextHistory, currentCanvas]);
    setHistoryStep(nextHistory.length);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setCanvasImages(history[prevStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setCanvasImages(history[nextStep]);
    }
  };

  // Capture initial state
  useEffect(() => {
    if (history.length === 0 && canvasImages.length > 0) {
      setHistory([canvasImages]);
      setHistoryStep(0);
    }
  }, [canvasImages]);

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

  const handleStageMouseDown = (e: any) => {
    if (tool !== "eraser" || !selectedId) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    if (!point) return;

    const node = stage.findOne(`#img_${selectedId}`);
    if (!node) return;

    const transform = node.getAbsoluteTransform().copy().invert();
    const localPos = transform.point(point);

    isDrawing.current = true;

    const selectedImg = canvasImages.find(i => i.id === selectedId);
    if (!selectedImg) return;

    const newLine = {
      points: [localPos.x, localPos.y],
      strokeWidth: eraserRadius / (node.scaleX() || 1),
      profile: eraserProfile
    };

    updateImage(selectedId, {
      maskLines: [...(selectedImg.maskLines || []), newLine]
    });
  };

  const handleStageMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    if (point) {
      const transform = stage.getAbsoluteTransform().copy().invert();
      const stagePos = transform.point(point);
      setCursorPos(stagePos);
    }

    if (!isDrawing.current || tool !== "eraser" || !selectedId) return;

    const node = stage.findOne(`#img_${selectedId}`);
    if (!node) return;

    const transform = node.getAbsoluteTransform().copy().invert();
    const localPos = transform.point(point);

    const selectedImg = canvasImages.find(i => i.id === selectedId);
    if (!selectedImg) return;

    const lines = [...(selectedImg.maskLines || [])];
    if (lines.length === 0) return;

    const lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([localPos.x, localPos.y]);

    updateImage(selectedId, { maskLines: lines });
  };

  const handleStageMouseUp = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      setTimeout(commitHistory, 0);
    }
  };

  const handleAddImage = (img: any) => {
    const newImg: CanvasImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: img.name,
      url: `${API_BASE}${img.url}`,
      x: 50 + canvasImages.length * 20,
      y: 50 + canvasImages.length * 20,
      width: (img.width && img.width > 0) ? img.width / 4 : 400,
      height: (img.height && img.height > 0) ? img.height / 4 : 300,
      opacity: 1,
      blendMode: "source-over",
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      maskLines: []
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

  const handleExportGIMP = async () => {
    if (canvasImages.length === 0) return;
    
    const layers = [];
    const bounds = getCompositionBounds() || { x: 0, y: 0, width: 2000, height: 2000 };
    
    for (const img of canvasImages) {
      if (img.opacity === 0) continue;
      
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = bounds.width;
      layerCanvas.height = bounds.height;
      const ctx = layerCanvas.getContext('2d');
      if (!ctx) continue;
      
      const domImg = new window.Image();
      domImg.crossOrigin = 'anonymous';
      domImg.src = img.url;
      await new Promise(resolve => { domImg.onload = resolve; domImg.onerror = resolve; });
      
      ctx.translate(-bounds.x, -bounds.y);
      ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
      ctx.rotate(img.rotation * Math.PI / 180);
      ctx.scale(img.scaleX, img.scaleY);
      
      ctx.globalAlpha = img.opacity !== undefined ? img.opacity : 1;
      
      ctx.drawImage(domImg, -img.width / 2, -img.height / 2, img.width, img.height);
      
      if (img.maskLines && img.maskLines.length > 0) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const line of img.maskLines) {
           ctx.lineWidth = line.strokeWidth;
           ctx.beginPath();
           if (line.points.length >= 2) {
             ctx.moveTo(line.points[0], line.points[1]);
             for (let i = 2; i < line.points.length; i += 2) {
               ctx.lineTo(line.points[i], line.points[i+1]);
             }
           }
           ctx.stroke();
        }
      }
      
      let psdBlendMode = 'normal';
      if (img.blendMode === 'screen') psdBlendMode = 'screen';
      if (img.blendMode === 'multiply') psdBlendMode = 'multiply';
      if (img.blendMode === 'overlay') psdBlendMode = 'overlay';
      if (img.blendMode === 'darken') psdBlendMode = 'darken';
      if (img.blendMode === 'lighten') psdBlendMode = 'lighten';
      
      layers.push({
        name: img.name || `Layer ${img.id}`,
        blendMode: psdBlendMode,
        opacity: Math.round((img.opacity ?? 1) * 255),
        canvas: layerCanvas
      });
    }
    
    // Reverse so the visual stack matches Photoshop (first in array = top visually)
    layers.reverse();

    const psd = {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      children: layers
    };
    
    try {
      const buffer = writePsd(psd as any);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `gimp_project_${Date.now()}.psd`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PSD Export Error:", err);
      alert("Failed to export PSD file.");
    }
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
    <div className="flex flex-col h-full overflow-hidden bg-[#1a1a1a]">
      {/* Canvas Toolbar */}
      <div className="min-h-[40px] py-2 bg-dark-sidebar/40 border-b border-dark-border flex flex-wrap items-center px-4 gap-y-3 gap-x-4">
        <div className="flex items-center gap-4 shrink-0">
           <select
             value={tool}
             onChange={(e) => setTool(e.target.value as any)}
             className="bg-black/40 border border-white/10 rounded text-[10px] h-7 px-2 font-bold uppercase text-white/80 outline-none"
           >
             <option value="transform">Move / Rotate</option>
             <option value="resize">Scale Image</option>
             <option value="eraser">Eraser Brush</option>
           </select>

           <div className="flex items-center gap-2">
             <button
               onClick={handleUndo}
               disabled={historyStep <= 0}
               className="px-2 py-1 bg-black/20 border border-white/5 rounded text-[9px] uppercase font-bold text-white/60 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:hover:text-white/60 disabled:hover:border-white/5 transition-all"
               title="Undo (Ctrl+Z)"
             >
               Undo
             </button>
             <button
               onClick={handleRedo}
               disabled={historyStep >= history.length - 1}
               className="px-2 py-1 bg-black/20 border border-white/5 rounded text-[9px] uppercase font-bold text-white/60 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:hover:text-white/60 disabled:hover:border-white/5 transition-all"
               title="Redo (Ctrl+Y)"
             >
               Redo
             </button>
           </div>
        </div>
       {tool === "eraser" && (
         <div className="flex items-center gap-4 border-l border-white/10 pl-4 ml-2">
           <div className="flex items-center gap-2">
             <span className="text-[9px] uppercase font-bold text-white/40">Size</span>
             <input
               type="range" min="5" max="200" value={eraserRadius}
               onChange={(e) => setEraserRadius(parseInt(e.target.value))}
               className="w-24 h-1 accent-purple-500 bg-white/10 rounded-full appearance-none cursor-pointer"
             />
             <span className="text-[10px] text-white/60 font-bold">{eraserRadius}px</span>
           </div>
           <button 
             onClick={() => selectedId && updateImage(selectedId, { maskLines: [] })}
             className="text-[10px] uppercase font-bold text-white/40 hover:text-red-400 border border-white/10 px-2 py-1 rounded transition-colors"
           >
             Clear Mask
           </button>
         </div>
       )}

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
         <button id="canvas-export-gimp" onClick={handleExportGIMP} className="dark-button bg-purple-900/20 text-purple-400 border-purple-500/20 flex gap-2">
           <Download size={14} /> Export to GIMP (.psd)
         </button>
      </div>
    </div>

    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Asset Panel */}
      <div className="w-64 shrink-0 border-r border-dark-border bg-dark-sidebar flex flex-col p-4 z-10 shadow-lg">
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
                  <img src={`${API_BASE}${img.url}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt={img.name} />
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
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddImage(img); }}
                      className="p-1 hover:text-dark-accent text-white" 
                      title="Add to Canvas"
                    >
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
        <div className="flex-1 flex relative overflow-hidden bg-[#0a0a0a]">
          <div className="flex-1 overflow-auto relative">
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
              handleStageMouseDown(e);
              const clickedOnEmpty = e.target === e.target.getStage();
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
            }}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchStart={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
            }}
          >
            {canvasImages.map((img) => (
              <Layer key={img.id}>
                <URLImage
                  image={img}
                  isSelected={img.id === selectedId}
                  onSelect={() => setSelectedId(img.id)}
                  onChange={(newAttrs) => {
                    updateImage(img.id, newAttrs);
                  }}
                  tool={tool}
                  commitHistory={commitHistory}
                />
              </Layer>
            ))}
            <Layer>
              {tool === "eraser" && cursorPos && (
                <Circle
                  x={cursorPos.x}
                  y={cursorPos.y}
                  radius={eraserRadius / 2}
                  stroke="rgba(147, 51, 234, 0.6)"
                  strokeWidth={2}
                  listening={false}
                />
              )}
            </Layer>
          </Stage>
          </div>
        </div>
      </div>

        {/* Layer Sidebar */}
        <PropertiesSidebar 
          canvasImages={canvasImages}
          setCanvasImages={setCanvasImages}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          updateImage={updateImage}
          handleMergeLayers={() => {
             // Merging layers logic
             if (canvasImages.length <= 1) return;
             alert("Layer merging is under construction.");
          }}
        />
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
              src={`${API_BASE}${enlargedImage.url}`} 
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
