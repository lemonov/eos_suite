"use client";

import { useState, useEffect, useRef } from "react";
import { Sliders, RefreshCw, Layout, RotateCw, Contrast, Sun, Droplets, Maximize, Save } from "lucide-react";
import { ImageInfo } from "@/app/page";

const API_BASE = "http://localhost:8000";

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: number;
  scale: number;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotation: 0,
  scale: 100,
  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0,
};

interface AdjustViewProps {
  images: {
    raw: ImageInfo[];
    processed: ImageInfo[];
    stacked: ImageInfo[];
  };
  onRefresh: () => void;
}

export default function AdjustView({ images, onRefresh }: AdjustViewProps) {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [isSaving, setIsSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load adjustments when an image is selected
  useEffect(() => {
    if (selectedImage) {
      const saved = localStorage.getItem(`adjust_${selectedImage.name}`);
      if (saved) {
        try {
          setAdjustments(JSON.parse(saved));
        } catch (e) {
          setAdjustments(DEFAULT_ADJUSTMENTS);
        }
      } else {
        setAdjustments(DEFAULT_ADJUSTMENTS);
      }
    }
  }, [selectedImage]);

  // Save adjustments when they change
  const handleAdjustmentChange = (key: keyof Adjustments, value: number) => {
    const newAdjustments = { ...adjustments, [key]: value };
    setAdjustments(newAdjustments);
    if (selectedImage) {
      localStorage.setItem(`adjust_${selectedImage.name}`, JSON.stringify(newAdjustments));
    }
  };

  const resetAdjustments = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
    if (selectedImage) {
      localStorage.removeItem(`adjust_${selectedImage.name}`);
    }
  };

  const saveToOverwriteOriginal = async () => {
    if (!selectedImage || !imgRef.current) return;
    setIsSaving(true);
    
    try {
      const img = imgRef.current;
      const canvas = document.createElement("canvas");
      const scaleStr = adjustments.scale / 100;
      
      const rad = adjustments.rotation * Math.PI / 180;
      const sin = Math.sin(rad);
      const cos = Math.cos(rad);
      
      const width = img.naturalWidth * scaleStr;
      const height = img.naturalHeight * scaleStr;
      
      const bbWidth = Math.abs(width * cos) + Math.abs(height * sin);
      const bbHeight = Math.abs(height * cos) + Math.abs(width * sin);

      canvas.width = bbWidth;
      canvas.height = bbHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.translate(bbWidth / 2, bbHeight / 2);
      ctx.rotate(rad);
      ctx.scale(scaleStr, scaleStr);
      
      ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
      
      // Handle Cropping
      const cropL = (adjustments.cropLeft / 100) * bbWidth;
      const cropR = (adjustments.cropRight / 100) * bbWidth;
      const cropT = (adjustments.cropTop / 100) * bbHeight;
      const cropB = (adjustments.cropBottom / 100) * bbHeight;
      
      const finalWidth = bbWidth - cropL - cropR;
      const finalHeight = bbHeight - cropT - cropB;
      
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = finalWidth;
      cropCanvas.height = finalHeight;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) throw new Error("Could not get crop canvas context");
      
      cropCtx.drawImage(canvas, cropL, cropT, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);
      
      const dataUrl = cropCanvas.toDataURL("image/png", 1.0);

      const res = await fetch(`${API_BASE}/images/overwrite/${selectedImage.name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl })
      });

      if (res.ok) {
        alert("Image overwritten successfully.");
        resetAdjustments();
        onRefresh();
      } else {
        const err = await res.json();
        alert("Save failed: " + (err.detail || "Server error"));
      }
    } catch (e) {
      console.error(e);
      alert("Save failed due to an error.");
    } finally {
      setIsSaving(false);
    }
  };

  const getFilterCSS = () => {
    return `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
  };

  const getTransformCSS = () => {
    return `rotate(${adjustments.rotation}deg) scale(${adjustments.scale / 100})`;
  };

  const getClipPath = () => {
    return `inset(${adjustments.cropTop}% ${adjustments.cropRight}% ${adjustments.cropBottom}% ${adjustments.cropLeft}%)`;
  };

  const allImages = [
    ...images.raw.map((img) => ({ ...img, type: "raw" as const })),
    ...images.stacked.map((img) => ({ ...img, type: "stacked" as const })),
    ...images.processed.map((img) => ({ ...img, type: "processed" as const }))
  ];

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#1a1a1a]">
      {/* Left Sidebar - Image Selection */}
      <div className="w-64 shrink-0 border-r border-dark-border bg-dark-sidebar flex flex-col p-4 z-10 shadow-xl">
        <h3 className="sidebar-title flex items-center gap-2 mb-4">
            <Layout size={12} className="text-dark-accent" /> Select Image
        </h3>
        <div className="flex-1 overflow-auto space-y-2 pr-2">
          {allImages.length === 0 && (
            <p className="text-[10px] opacity-20 italic">No images in library.</p>
          )}
          {allImages.map((img, idx) => (
            <div 
                key={idx} 
                onClick={() => setSelectedImage(img)}
                className={`group relative bg-black/40 border rounded cursor-pointer transition-all flex flex-col ${selectedImage?.name === img.name ? 'border-dark-accent ring-1 ring-dark-accent/50' : 'border-white/10 hover:border-white/30'}`}
            >
              <div className="relative h-24 flex-none bg-black/20">
                <img src={`${API_BASE}${img.url}`} className="w-full h-full object-cover" alt={img.name} />
                <div className={`absolute top-1 left-1 px-1 py-0.5 rounded-xs text-[6px] font-bold uppercase z-10 ${img.type === 'raw' ? 'bg-blue-600/80' : img.type === 'stacked' ? 'bg-purple-600/80' : 'bg-green-600/80'}`}>
                  {img.type}
                </div>
              </div>
              <div className="bg-[#111] p-2 border-t border-white/5 mx-0 h-auto w-full box-border">
                 <p className="text-[10px] font-bold text-white/90 truncate leading-tight overflow-hidden text-ellipsis whitespace-nowrap" title={img.name}>{img.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Adjustment View */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-dark-bg">
        {selectedImage ? (
          <div className="flex-1 flex overflow-hidden">
             {/* Left side: Viewport */}
             <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden bg-[#0a0a0a]">
                <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      ref={imgRef}
                      crossOrigin="anonymous"
                      src={`${API_BASE}${selectedImage.url}`}
                      alt={selectedImage.name}
                        style={{
                          filter: getFilterCSS(),
                          transform: getTransformCSS(),
                          clipPath: getClipPath(),
                          transition: 'filter 0.1s ease-out, transform 0.1s ease-out, clip-path 0.1s ease-out'
                        }}
                      className="max-w-full max-h-full object-contain shadow-2xl"
                    />
                </div>
             </div>

             {/* Right side: Tools */}
             <div className="w-80 shrink-0 border-l border-dark-border bg-dark-sidebar flex flex-col p-6 overflow-auto">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="sidebar-title flex items-center gap-2 m-0">
                      <Sliders size={12} className="text-dark-accent" /> Adjustments
                  </h3>
                  <button 
                    onClick={resetAdjustments}
                    className="text-[10px] uppercase font-bold tracking-wider text-white/40 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Reset
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Brightness */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-white/60">
                      <span className="flex items-center gap-2"><Sun size={12}/> Brightness</span>
                      <span>{adjustments.brightness}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="200" value={adjustments.brightness}
                      onChange={(e) => handleAdjustmentChange('brightness', parseInt(e.target.value))}
                      className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                  
                  {/* Contrast */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-white/60">
                      <span className="flex items-center gap-2"><Contrast size={12}/> Contrast</span>
                      <span>{adjustments.contrast}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="200" value={adjustments.contrast}
                      onChange={(e) => handleAdjustmentChange('contrast', parseInt(e.target.value))}
                      className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-white/60">
                      <span className="flex items-center gap-2"><Droplets size={12}/> Saturation</span>
                      <span>{adjustments.saturation}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="200" value={adjustments.saturation}
                      onChange={(e) => handleAdjustmentChange('saturation', parseInt(e.target.value))}
                      className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="h-px bg-white/5 my-4" />

                  {/* Rotation */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-white/60">
                      <span className="flex items-center gap-2"><RotateCw size={12}/> Rotation</span>
                      <span>{adjustments.rotation}°</span>
                    </div>
                    <input 
                      type="range" min="-180" max="180" value={adjustments.rotation}
                      onChange={(e) => handleAdjustmentChange('rotation', parseInt(e.target.value))}
                      className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Scale / Zoom */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-white/60">
                      <span className="flex items-center gap-2"><Maximize size={12}/> Scale (Zoom)</span>
                      <span>{adjustments.scale}%</span>
                    </div>
                    <input 
                      type="range" min="10" max="300" value={adjustments.scale}
                      onChange={(e) => handleAdjustmentChange('scale', parseInt(e.target.value))}
                      className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="h-px bg-white/5 my-4" />
                  <div className="text-[10px] uppercase font-bold text-dark-accent mb-2">Cropping (Margins %)</div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold text-white/40">Top</label>
                        <input 
                        type="range" min="0" max="50" value={adjustments.cropTop}
                        onChange={(e) => handleAdjustmentChange('cropTop', parseInt(e.target.value))}
                        className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold text-white/40">Bottom</label>
                        <input 
                        type="range" min="0" max="50" value={adjustments.cropBottom}
                        onChange={(e) => handleAdjustmentChange('cropBottom', parseInt(e.target.value))}
                        className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold text-white/40">Left</label>
                        <input 
                        type="range" min="0" max="50" value={adjustments.cropLeft}
                        onChange={(e) => handleAdjustmentChange('cropLeft', parseInt(e.target.value))}
                        className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold text-white/40">Right</label>
                        <input 
                        type="range" min="0" max="50" value={adjustments.cropRight}
                        onChange={(e) => handleAdjustmentChange('cropRight', parseInt(e.target.value))}
                        className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                  </div>

                </div>

                <div className="mt-8 pt-4 border-t border-white/5">
                   <button 
                     onClick={saveToOverwriteOriginal}
                     disabled={isSaving}
                     className="w-full bg-dark-accent hover:bg-dark-accent/80 text-black font-bold py-3 text-[11px] rounded flex items-center justify-center gap-2"
                   >
                     <Save size={14} />
                     {isSaving ? "Saving..." : "Save (Overwrite Original)"}
                   </button>
                   <p className="text-[9px] text-white/30 italic text-center mt-3 px-2">
                     Warning: Saving will bake the modifications and permanently overwrite the original image file!
                   </p>
                </div>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-20">
            <Sliders size={48} className="mb-4" />
            <p className="text-sm uppercase tracking-widest font-bold">No Image Selected</p>
            <p className="text-xs">Select an image from the sidebar to begin adjusting.</p>
          </div>
        )}
      </div>
    </div>
  );
}
