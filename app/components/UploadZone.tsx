"use client";

import { ImageIcon, Layers, Plus, X } from "lucide-react";
import type { UploadedImage } from "./types";

/** Drag-drop / paste / click image picker. Renders a thumbnail grid once
 *  any image is attached, otherwise an empty-state CTA. */
export function UploadZone({
  images,
  dragging,
  setDragging,
  onDrop,
  onPick,
  onRemove,
  onClearAll,
  fileInputRef,
  onFileChange,
}: {
  images: UploadedImage[];
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onPick: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const hasImages = images.length > 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="glass transition-all duration-300 animate-slide-up overflow-hidden"
      style={{
        minHeight: hasImages ? undefined : 200,
        borderStyle: "dashed",
        borderColor: dragging
          ? "var(--terracotta)"
          : "color-mix(in oklab, var(--border-warm) 80%, transparent)",
        borderWidth: 2,
        transform: dragging ? "scale(1.005)" : "scale(1)",
        boxShadow: dragging
          ? "inset 0 1px 0 rgba(255,255,255,0.5), 0 12px 40px rgba(201,100,66,0.2)"
          : undefined,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      {hasImages ? (
        <div className="p-3 sm:p-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {images.map((img, i) => (
              <div
                key={img.id}
                className="relative aspect-square overflow-hidden animate-scale-in group"
                style={{
                  borderRadius: "calc(var(--radius) - 4px)",
                  backgroundColor: "var(--warm-sand)",
                  border: "1px solid color-mix(in oklab, var(--border-warm) 80%, transparent)",
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={`สลิป ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: "rgba(20,20,19,0.7)",
                    color: "var(--ivory)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  #{i + 1}
                </div>
                <button
                  onClick={() => onRemove(img.id)}
                  aria-label={`ลบรูปที่ ${i + 1}`}
                  className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center press-shrink transition-transform hover:scale-110"
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: "rgba(20,20,19,0.75)",
                    color: "var(--ivory)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            <button
              onClick={onPick}
              className="aspect-square flex flex-col items-center justify-center gap-1.5 press-shrink transition-all hover:scale-[1.02]"
              style={{
                borderRadius: "calc(var(--radius) - 4px)",
                border: "2px dashed color-mix(in oklab, var(--border-warm) 80%, transparent)",
                backgroundColor: "color-mix(in oklab, var(--ivory) 40%, transparent)",
                color: "var(--text-secondary)",
              }}
              aria-label="เพิ่มรูป"
            >
              <Plus size={20} style={{ color: "var(--terracotta)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--charcoal-warm)" }}>
                เพิ่มรูป
              </span>
            </button>
          </div>

          <div
            className="flex items-center justify-between gap-2 px-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span className="text-xs flex items-center gap-1.5">
              <Layers size={12} />
              {images.length} รูป — ระบบจะวิเคราะห์และรวมยอดให้อัตโนมัติ
            </span>
            <button
              onClick={onClearAll}
              className="text-xs underline underline-offset-2 press-shrink hover:opacity-70"
              style={{ color: "var(--danger)" }}
            >
              ล้างทั้งหมด
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="w-full flex flex-col items-center justify-center gap-3 py-10 sm:py-14 px-4 cursor-pointer press-shrink"
        >
          <div
            className={`glass-chip flex items-center justify-center ${dragging ? "" : "animate-pulse-soft"}`}
            style={{
              width: 56,
              height: 56,
              backgroundColor: dragging
                ? "color-mix(in oklab, var(--terracotta) 15%, transparent)"
                : undefined,
              transition: "background-color 0.25s ease",
            }}
          >
            <ImageIcon
              size={24}
              style={{ color: dragging ? "var(--terracotta)" : "var(--text-secondary)" }}
            />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm" style={{ color: "var(--charcoal-warm)" }}>
              {dragging ? "วางได้เลย!" : "แตะเพื่อเลือก หรือลากรูปมาวาง"}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              รองรับหลายรูป • JPG, PNG, WEBP • วาง Ctrl+V ก็ได้
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
