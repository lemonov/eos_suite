"use client";

import { useState } from "react";
import { Copy, Trash2, Heart, Search, Maximize2, Minimize2 } from "lucide-react";

interface ImageInfo {
  name: string;
  url: string;
  preview_url?: string;
  normalized_url?: string;
  type: "raw" | "processed" | "stacked";
  width?: number;
  height?: number;
}

interface ImageCardProps {
  img: ImageInfo;
  onRefresh?: () => void;
}

const ImageCard = ({ img, onRefresh }: ImageCardProps) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isEnlarged, setIsEnlarged] = useState(false);

  const handleDelete = async (type: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/images/${type}/${name}`, {
        method: "DELETE"
      });
      if (res.ok) {
        onRefresh && onRefresh();
      }
    } catch (e) {
      alert("Delete failed");
    }
  };

  const imageUrl = `http://localhost:8000${img.preview_url || img.url}${retryCount > 0 ? `?v=${retryCount}` : ""}`;

  return (
    <div className="group relative bg-[#1a1a1a] border border-white/5 p-1 transition-all hover:border-dark-accent/40 shadow-xl overflow-hidden rounded-sm aspect-square flex flex-col">
      <div className="relative flex-1 overflow-hidden bg-black/20">
        <img
          src={imageUrl}
          alt={img.name}
          onError={() => {
            if (retryCount < 3) {
              setTimeout(() => setRetryCount(retryCount + 1), 1000);
            }
          }}
          className="object-cover w-full h-full grayscale transition-all group-hover:grayscale-0 group-hover:scale-105 duration-700"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 gap-2 z-20">
           <button 
             className="p-1 hover:text-dark-accent"
             onClick={(e) => { e.stopPropagation(); setIsEnlarged(true); }}
             title="Fullscreen Preview"
           >
             <Maximize2 size={14} />
           </button>
           <button className="p-1 hover:text-dark-accent"><Heart size={14} /></button>
           <button className="p-1 hover:text-dark-accent ml-auto"><Copy size={14} /></button>
           <button 
            onClick={(e) => { e.stopPropagation(); handleDelete(img.type, img.name); }}
            className="p-1 hover:text-red-500"
           >
             <Trash2 size={14} />
           </button>
        </div>
        {/* Label */}
        <div className={`absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded-xs text-[8px] font-bold uppercase ${img.type === 'raw' ? 'bg-blue-600/80 text-white' : img.type === 'stacked' ? 'bg-purple-600/80 text-white' : 'bg-green-600/80 text-white'}`}>
            {img.type}
        </div>
      </div>

      {/* Filename Footer - Solid flex display */}
      <div className="bg-[#111] p-2 border-t border-white/5 shrink-0 z-10">
        <p className="text-[10px] font-bold text-white/90 truncate leading-tight" title={img.name}>
          {img.name}
        </p>
      </div>

      {/* Fullscreen Preview Modal */}
      {isEnlarged && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setIsEnlarged(false)}
        >
          <button 
            onClick={() => setIsEnlarged(false)}
            className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-3 rounded-full transition-colors z-50"
          >
            <Minimize2 size={24} />
          </button>
          
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center">
            {/* We show the full-res version if available, otherwise the preview */}
            <img 
              src={`http://localhost:8000${img.normalized_url || img.url}`} 
              className="max-w-full max-h-[90vh] object-contain" 
              alt={`Fullscreen ${img.name}`}
              onClick={(e) => e.stopPropagation()} 
            />
            <div className="mt-4 px-4 py-2 bg-black/50 rounded flex gap-4 text-xs font-bold items-center sticky bottom-0">
              <span className="opacity-50 text-white">Filename:</span>
              <span className="text-white">{img.name}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface LibraryProps {
  images: {
    raw: any[];
    processed: any[];
    stacked: any[];
  };
  onRefresh: () => void;
}

export default function Library({ images, onRefresh }: LibraryProps) {
  const allImages: ImageInfo[] = [
    ...images.raw.map(img => ({ ...img, type: "raw" as const })),
    ...images.stacked.map(img => ({ ...img, type: "stacked" as const })),
    ...images.processed.map(img => ({ ...img, type: "processed" as const }))
  ];

  if (allImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 opacity-20">
        <Search size={48} className="mb-4" />
        <p className="text-sm uppercase tracking-widest font-bold">No images captured yet.</p>
        <p className="text-xs">Select your camera and press "Shutter Release".</p>
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in duration-500">
      {allImages.map((img, idx) => (
        <ImageCard key={idx} img={img} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
