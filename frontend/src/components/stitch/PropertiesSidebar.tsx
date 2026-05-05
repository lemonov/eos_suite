"use client";

import React from "react";
import { Layers, Trash2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PropertiesSidebarProps {
  canvasImages: any[];
  setCanvasImages: React.Dispatch<React.SetStateAction<any[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  updateImage: (id: string, changes: any) => void;
  handleMergeLayers: () => void;
}

export default function PropertiesSidebar({
  canvasImages,
  setCanvasImages,
  selectedId,
  setSelectedId,
  updateImage,
  handleMergeLayers
}: PropertiesSidebarProps) {
  
  const moveLayerUp = (idx: number) => {
    if (idx <= 0) return;
    setCanvasImages(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveLayerDown = (idx: number) => {
    if (idx >= canvasImages.length - 1) return;
    setCanvasImages(prev => {
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  };

  const selectedImage = canvasImages.find(img => img.id === selectedId);

  return (
    <div className="w-64 shrink-0 border-l border-dark-border bg-dark-sidebar flex flex-col p-4">
      <h3 className="sidebar-title flex items-center gap-2 mb-4">
        <Layers size={12} className="text-dark-accent" /> Layers
      </h3>
      <div className="flex-1 overflow-auto space-y-1">
        {[...canvasImages].reverse().map((img, index) => (
          <div 
            key={img.id}
            onClick={() => setSelectedId(img.id)}
            className={cn(
              "p-2 rounded text-xs font-bold cursor-pointer transition-colors flex items-center justify-between border",
              selectedId === img.id 
                ? "bg-dark-accent/20 text-dark-accent border-dark-accent/40" 
                : "bg-black/20 hover:bg-white/5 border-white/5 text-white/80"
            )}
          >
            <span className="truncate flex-1 pr-2">{img.name}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); moveLayerUp(index); }}
                disabled={index === 0}
                className="text-white/30 hover:text-white disabled:opacity-10 text-[9px] px-1"
              >
                ▲
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); moveLayerDown(index); }}
                disabled={index === canvasImages.length - 1}
                className="text-white/30 hover:text-white disabled:opacity-10 text-[9px] px-1"
              >
                ▼
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCanvasImages(prev => prev.filter(i => i.id !== img.id));
                  if (selectedId === img.id) setSelectedId(null);
                }}
                className="text-white/40 hover:text-red-500 flex items-center justify-center p-1 ml-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {canvasImages.length > 1 && (
          <button 
            onClick={handleMergeLayers}
            className="w-full mt-2 bg-purple-900/30 text-purple-400 border border-purple-500/30 p-2 text-[10px] font-bold uppercase rounded hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-2"
          >
            <Layers size={14} /> Merge Layers
          </button>
        )}
      </div>

      {selectedImage && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-dark-accent">Layer Settings</h4>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] uppercase font-bold text-white/40">
              <span>Opacity</span>
              <span className="text-dark-accent">{Math.round((selectedImage.opacity ?? 1) * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.01"
              value={selectedImage.opacity ?? 1}
              onChange={(e) => updateImage(selectedId!, { opacity: parseFloat(e.target.value) })}
              className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-white/40">Blend Mode</label>
            <select
              value={selectedImage.blendMode}
              onChange={(e) => updateImage(selectedId!, { blendMode: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded text-[10px] uppercase font-bold text-white/80 h-8 px-2 outline-none cursor-pointer"
            >
              <option value="source-over">Normal</option>
              <option value="screen">Screen</option>
              <option value="multiply">Multiply</option>
              <option value="overlay">Overlay</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] uppercase font-bold text-white/40">
              <span>Brightness</span>
              <span className="text-dark-accent">{selectedImage.brightness ?? 100}%</span>
            </div>
            <input
              type="range" min="0" max="200"
              value={selectedImage.brightness ?? 100}
              onChange={(e) => updateImage(selectedId!, { brightness: parseInt(e.target.value) })}
              className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] uppercase font-bold text-white/40">
              <span>Contrast</span>
              <span className="text-dark-accent">{selectedImage.contrast ?? 100}%</span>
            </div>
            <input
              type="range" min="0" max="200"
              value={selectedImage.contrast ?? 100}
              onChange={(e) => updateImage(selectedId!, { contrast: parseInt(e.target.value) })}
              className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] uppercase font-bold text-white/40">
              <span>Saturation</span>
              <span className="text-dark-accent">{selectedImage.saturation ?? 100}%</span>
            </div>
            <input
              type="range" min="0" max="200"
              value={selectedImage.saturation ?? 100}
              onChange={(e) => updateImage(selectedId!, { saturation: parseInt(e.target.value) })}
              className="w-full h-1 accent-dark-accent bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
