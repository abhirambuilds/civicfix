'use client';

import React from 'react';
import { IssueImage } from '@/types';
import { IconX } from '@/components/ui/Icons';

interface ImagePreviewModalProps {
  image: IssueImage | null;
  onClose: () => void;
}

export function ImagePreviewModal({ image, onClose }: ImagePreviewModalProps) {
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Photo Evidence Preview"
    >
      <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex flex-col">
            <h4 className="text-sm font-semibold text-white">
              {image.fileName || 'Attached Photo Evidence'}
            </h4>
            <span className="text-xs text-slate-400">
              {(image.fileSize / 1024).toFixed(1)} KB &bull; {image.mimeType}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close modal"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Image Preview Container */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/40 min-h-[300px]">
          {image.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.signedUrl}
              alt={image.fileName || 'Issue attachment evidence'}
              className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain border border-slate-800"
            />
          ) : (
            <div className="text-center text-slate-400 p-8">
              <p>Image preview unavailable or signed URL expired.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Uploaded: {new Date(image.createdAt).toLocaleString()}</span>
          {image.isPrimary && (
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
              Primary Evidence
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
