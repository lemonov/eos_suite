"use client";

import { useState } from "react";
import { Copy, Trash2, Heart, Search, Maximize2, Minimize2, ChevronDown, ChevronRight } from "lucide-react";

interface ImageInfo {
  name: string;
  url: string;
  type: "raw" | "processed" | "stacked";
  width?: number;
  height?: number;
  session?: string;
}

interface ImageCardProps {
  img: ImageInfo;
  onRefresh?: () => void;
}

const ImageCard = ({ img, onRefresh }: ImageCardProps) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isEnlarged, setIsEnlarged] = useState(false);

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/images/${name}`, {
        method: "DELETE"
      });
      if (res.ok) {
        onRefresh && onRefresh();
      }
    } catch (e) {
      alert("Delete failed");
    }
  };

  const handleDuplicate = async (img: ImageInfo) => {
    try {
      const res = await fetch(`http://localhost:8000/images/duplicate/${img.name}`, {
        method: "POST"
      });
      if (res.ok) {
        onRefresh && onRefresh();
      } else {
        alert("Duplicate failed: " + (await res.json()).detail);
      }
    } catch (e) {
      alert("Duplicate failed due to error");
    }
  };

  const imageUrl = `http://localhost:8000${img.url}${retryCount > 0 ? `&v=${retryCount}` : ""}`;

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
           <button className="p-1 hover:text-dark-accent ml-auto" onClick={(e) => { e.stopPropagation(); handleDuplicate(img); }}><Copy size={14} /></button>
           <button 
            onClick={(e) => { e.stopPropagation(); handleDelete(img.name); }}
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
            <img
              src={`http://localhost:8000${img.url}`}
              alt={`Fullscreen ${img.name}`}
              className="max-w-full max-h-[85vh] object-contain border border-white/20"
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
    raw: ImageInfo[];
    processed: ImageInfo[];
    stacked: ImageInfo[];
  };
  onRefresh: () => void;
}

function formatSessionName(session: string) {
  if (!session || session === "Legacy" || session === "Unknown Date" || !session.includes('/')) return session || "Unknown Date";
  const parts = session.split('/');
  const dateParts = parts[0].split('_'); 
  const timeParts = parts[1].split('_'); 
  if (dateParts.length === 3 && timeParts.length === 3) {
    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
  }
  return session;
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

  // Group by Backend Session
  const groups: Record<string, typeof allImages> = {};
  
  allImages.forEach(img => {
    const sessionKey = img.session || "Unknown Date";
    if (!groups[sessionKey]) groups[sessionKey] = [];
    groups[sessionKey].push(img);
  });

  // Default state initialization inside component
  const sortedDayKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  
  // Set the newest session as open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    [sortedDayKeys[0]]: true
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500">
      {sortedDayKeys.map(dayKey => {
        const folderName = formatSessionName(dayKey);
        const isOpen = openGroups[dayKey] ?? false;

        return (
          <div key={dayKey} className="border border-white/5 bg-black/20 rounded-md overflow-hidden">
            <button 
              onClick={() => toggleGroup(dayKey)}
              className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                <span className="text-xs font-bold uppercase tracking-widest">{folderName}</span>
                <span className="text-[10px] text-white/40 ml-2">({groups[dayKey].length} items)</span>
              </div>
            </button>
            
            {isOpen && (
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-[#111]">
                {groups[dayKey].map((img, idx) => (
                  <ImageCard key={idx} img={img} onRefresh={onRefresh} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
