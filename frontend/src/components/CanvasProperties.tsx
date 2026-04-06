"use client";

import React from "react";
import { useCanvas } from "@/context/CanvasContext";
import { Sliders, FlipHorizontal, FlipVertical, Layers, Trash2, Download } from "lucide-react";

export default function CanvasProperties() {
  const { 
    canvasImages, 
    selectedId, 
    setSelectedId, 
    updateImage, 
    handleBringToFront, 
    handleSendToBack,
    setCanvasImages
  } = useCanvas();

  const selectedImage = canvasImages.find((i) => i.id === selectedId);

  if (!selectedId || !selectedImage) {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <div className="p-4 border-b border-white/5">
          <h3 className="sidebar-title flex items-center gap-2 mb-4">
            <Layers size={12} className="text-dark-accent" /> Project Settings
          </h3>
          <div className="p-3 bg-blue-500/10 rounded border border-blue-500/20 space-y-1">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Canvas Mode Active</p>
            <p className="text-[8px] text-blue-400/60 leading-relaxed">Select a layer to edit properties, or use the global actions below.</p>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-6">
           <div className="space-y-3">
              <h4 className="text-[9px] uppercase font-bold tracking-widest text-white/20">Composition Actions</h4>
              <div className="grid gap-2">
                 <button 
                  id="global-export-button"
                  onClick={() => {
                    // Trigger the export event that CanvasView listens to, or just tell the user where it is
                    const btn = document.getElementById('canvas-export-btn');
                    if (btn) btn.click();
                  }}
                  className="w-full py-4 bg-dark-accent text-black rounded font-bold text-[11px] uppercase flex items-center justify-center gap-2 hover:bg-dark-accent/80 transition-all shadow-lg"
                 >
                    <Download size={16} /> Export Composition
                 </button>
                 <button 
                  onClick={() => {
                    const btn = document.getElementById('canvas-save-btn');
                    if (btn) btn.click();
                  }}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white/60 rounded font-bold text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                 >
                    <Layers size={14} /> Save to Gallery
                 </button>
              </div>
           </div>

           <div className="p-4 border border-dashed border-white/5 rounded flex flex-col items-center justify-center text-center opacity-40 py-10">
              <Sliders size={24} className="mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest">No Layer Selected</p>
              <p className="text-[9px] mt-1">Click an image on the stage to view its properties.</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-white/5">
        <h3 className="sidebar-title flex items-center gap-2 mb-4">
          <Sliders size={12} className="text-dark-accent" /> Image Properties
        </h3>
        <div className="p-3 bg-black/40 rounded border border-white/5 space-y-1">
          <p className="text-[10px] font-bold text-white truncate" title={selectedImage.name}>
            {selectedImage.name}
          </p>
          <p className="text-[8px] uppercase tracking-widest text-white/20">Layer ID: {selectedImage.id}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Transformations */}
        <div className="space-y-3">
          <h4 className="text-[9px] uppercase font-bold tracking-widest text-white/20">Transformations</h4>
          <div className="flex gap-2">
            <button
              onClick={() => updateImage(selectedId, { scaleX: (selectedImage.scaleX || 1) * -1 })}
              className="flex-1 aspect-square bg-white/5 border border-white/10 rounded flex flex-col items-center justify-center gap-2 hover:bg-white/10 hover:border-dark-accent transition-all group"
              title="Flip Horizontal"
            >
              <FlipHorizontal size={16} className="text-white/40 group-hover:text-dark-accent" />
              <span className="text-[8px] uppercase font-bold text-white/20">Flip H</span>
            </button>
            <button
              onClick={() => updateImage(selectedId, { scaleY: (selectedImage.scaleY || 1) * -1 })}
              className="flex-1 aspect-square bg-white/5 border border-white/10 rounded flex flex-col items-center justify-center gap-2 hover:bg-white/10 hover:border-dark-accent transition-all group"
              title="Flip Vertical"
            >
              <FlipVertical size={16} className="text-white/40 group-hover:text-dark-accent" />
              <span className="text-[8px] uppercase font-bold text-white/20">Flip V</span>
            </button>
          </div>
        </div>

        {/* Layer Arrangement */}
        <div className="space-y-3">
          <h4 className="text-[9px] uppercase font-bold tracking-widest text-white/20">Arrangement</h4>
          <div className="flex gap-2">
            <button
              onClick={handleBringToFront}
              className="flex-1 py-3 bg-white/5 border border-white/10 rounded flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-white/60 text-[9px] font-bold uppercase"
            >
              <Layers size={14} className="text-dark-accent" /> Bring Front
            </button>
            <button
              onClick={handleSendToBack}
              className="flex-1 py-3 bg-white/5 border border-white/10 rounded flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-white/60 text-[9px] font-bold uppercase"
            >
              <Layers size={14} className="text-white/20" /> Send Back
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="space-y-4">
          <h4 className="text-[9px] uppercase font-bold tracking-widest text-white/20">Appearance</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] uppercase font-bold">
              <span className="text-white/40">Opacity</span>
              <span className="text-dark-accent">{Math.round((selectedImage.opacity ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedImage.opacity ?? 1}
              onChange={(e) => updateImage(selectedId, { opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="text-[9px] uppercase font-bold text-white/40">Blending Mode</div>
            <select
              value={selectedImage.blendMode}
              onChange={(e) => updateImage(selectedId, { blendMode: e.target.value })}
              className="dark-input w-full"
            >
              <option value="source-over">Normal</option>
              <option value="screen">Screen</option>
              <option value="multiply">Multiply</option>
              <option value="overlay">Overlay</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 bg-black/40 border-t border-white/5">
        <button
          onClick={() => {
            setCanvasImages((prev) => prev.filter((i) => i.id !== selectedId));
            setSelectedId(null);
          }}
          className="w-full py-3 bg-red-900/20 text-red-500 border border-red-500/20 rounded font-bold text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-red-900/40 transition-all"
        >
          <Trash2 size={14} /> Remove Layer
        </button>
      </div>
    </div>
  );
}
