'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  IconUpload,
  IconImage,
  IconTrash,
  IconAlertCircle,
  IconCheckCircle,
} from '@/components/ui/Icons';

export interface ImageUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  disabled?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

interface PreviewItem {
  file: File;
  url: string;
}

export function ImageUploader({
  files,
  onFilesChange,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  disabled = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  // Derive preview URLs and ensure proper cleanup when files change or unmount
  const previews = useMemo<PreviewItem[]>(() => {
    return files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previews]);

  const validateAndAddFiles = (incomingFiles: FileList | File[]) => {
    setWarningMessage(null);
    const validNewFiles: File[] = [];
    const warnings: string[] = [];

    const availableSlots = maxFiles - files.length;
    if (availableSlots <= 0) {
      setWarningMessage(`Maximum of ${maxFiles} photos allowed per report.`);
      return;
    }

    const filesToProcess = Array.from(incomingFiles).slice(0, availableSlots);
    if (incomingFiles.length > availableSlots) {
      warnings.push(`Only up to ${maxFiles} photos are allowed. Excess files were ignored.`);
    }

    for (const file of filesToProcess) {
      // 1. MIME type validation
      if (!ALLOWED_TYPES.includes(file.type)) {
        warnings.push(`"${file.name}" is not a supported format. Please upload JPEG, PNG, or WebP.`);
        continue;
      }

      // 2. File size validation
      if (file.size > maxSizeBytes) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        warnings.push(`"${file.name}" exceeds the 5 MB limit (${sizeMb} MB).`);
        continue;
      }

      // 3. Avoid duplicate files
      const isDuplicate = files.some(
        (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
      );
      if (isDuplicate) {
        continue;
      }

      validNewFiles.push(file);
    }

    if (warnings.length > 0) {
      setWarningMessage(warnings[0]);
    }

    if (validNewFiles.length > 0) {
      onFilesChange([...files, ...validNewFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      // Reset input value so re-selecting same file triggers onChange
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    if (disabled) return;
    const updated = files.filter((_, idx) => idx !== indexToRemove);
    onFilesChange(updated);
    setWarningMessage(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        disabled={disabled || files.length >= maxFiles}
        onChange={handleFileSelect}
        aria-label="Upload issue photos"
      />

      {/* Drag & Drop Upload Zone */}
      {files.length < maxFiles && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => {
            if (!disabled && files.length < maxFiles) {
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`relative border-2 border-dashed rounded-xl p-6 transition-all text-center cursor-pointer ${
            isDragOver
              ? 'border-indigo-400 bg-indigo-950/30 ring-2 ring-indigo-500/20'
              : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <IconUpload size={22} />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-200">
                <span className="text-indigo-400 hover:underline">Click to upload</span> or drag and drop photos
              </p>
              <p className="text-xs text-slate-400">
                Supported: JPEG, PNG, WebP &bull; Max 5 MB per photo &bull; Up to {maxFiles} photos
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
              <IconImage size={13} />
              <span>
                {files.length} of {maxFiles} photos selected
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Warning / Validation Notice */}
      {warningMessage && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <IconAlertCircle size={16} className="text-amber-400 shrink-0" />
            <span>{warningMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setWarningMessage(null)}
            className="text-amber-400 hover:text-amber-200 text-xs font-semibold px-1"
            aria-label="Dismiss warning"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Selected Image Thumbnails Grid */}
      {previews.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <IconImage size={14} className="text-indigo-400" />
              <span>Selected Photos ({previews.length}/{maxFiles})</span>
            </span>
            <span className="text-[11px] text-slate-500">
              First image serves as the primary report thumbnail
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {previews.map((item, index) => (
              <div
                key={item.url}
                className="group relative rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm aspect-square flex flex-col"
              >
                {/* Image Preview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.file.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />

                {/* Primary Photo Badge */}
                {index === 0 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600/90 text-white backdrop-blur-sm shadow flex items-center gap-1">
                    <IconCheckCircle size={10} />
                    <span>Primary</span>
                  </div>
                )}

                {/* Gradient bottom overlay with file name & size */}
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end">
                  <p className="text-[11px] font-medium text-white truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="text-[10px] text-slate-300">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>

                {/* Remove Button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(index);
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/90 text-rose-400 hover:text-white hover:bg-rose-600 border border-slate-700/80 flex items-center justify-center transition-colors shadow focus:outline-none focus:ring-2 focus:ring-rose-400"
                    title={`Remove ${item.file.name}`}
                    aria-label={`Remove photo ${item.file.name}`}
                  >
                    <IconTrash size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
