'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { issuesApi, categoriesApi, ApiError } from '@/lib/api';
import { Coordinates, DEFAULT_CAMPUS_LOCATION } from '@/lib/constants';
import { IssueCategory, Issue } from '@/types';
import { LocationPicker } from '@/components/map/LocationPicker';
import { ImageUploader } from '@/components/report/ImageUploader';
import {
  IconChevronLeft,
  IconMapPin,
  IconTag,
  IconFileText,
  IconAlertCircle,
  IconCheckCircle,
  IconRefresh,
  IconArrowRight,
} from '@/components/ui/Icons';

type SubmitStage = 'idle' | 'creating' | 'uploading' | 'success';

interface FormErrors {
  title?: string;
  description?: string;
  categoryId?: string;
  location?: string;
  general?: string;
}

export default function ReportIssuePage() {
  const router = useRouter();

  // Form Field States
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<Coordinates>(
    DEFAULT_CAMPUS_LOCATION
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Categories Fetch States
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStage, setSubmitStage] = useState<SubmitStage>('idle');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [createdIssue, setCreatedIssue] = useState<Issue | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // 1. Fetch active categories from backend
  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoryError(null);
    try {
      const data = await categoriesApi.list();
      setCategories(data || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load issue categories from server.';
      setCategoryError(msg);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialFetch() {
      try {
        const data = await categoriesApi.list();
        if (isMounted) {
          setCategories(data || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Unable to load issue categories from server.';
          setCategoryError(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    initialFetch();

    return () => {
      isMounted = false;
    };
  }, []);


  // Derive issue title if left blank
  const resolveTitle = (rawTitle: string, desc: string, catId: string): string => {
    const trimmedTitle = rawTitle.trim();
    if (trimmedTitle.length >= 5) {
      return trimmedTitle.slice(0, 200);
    }

    const matchedCategory = categories.find((c) => c.id === catId);
    const categoryName = matchedCategory ? matchedCategory.name : 'Civic Issue';

    // Extract first sentence or phrase from description
    const firstSentence = desc
      .trim()
      .split(/[.\n]/)[0]
      .trim();

    if (firstSentence.length >= 5) {
      return firstSentence.slice(0, 100);
    }

    const fallback = `${categoryName}: ${desc.trim()}`.slice(0, 100);
    return fallback.length >= 5 ? fallback : `${categoryName} Report`;
  };

  // Client-side validation
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Validate Description
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      errors.description = 'Please enter an issue description.';
    } else if (trimmedDesc.length < 10) {
      errors.description = 'Description must be at least 10 characters long.';
    } else if (trimmedDesc.length > 3000) {
      errors.description = 'Description cannot exceed 3000 characters.';
    }

    // Validate Title (if user entered one)
    if (title.trim().length > 0 && title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters long if provided.';
    }

    // Validate Category
    if (!categoryId) {
      errors.categoryId = 'Please select a category for the issue.';
    }

    // Validate Location
    if (
      typeof selectedLocation.latitude !== 'number' ||
      typeof selectedLocation.longitude !== 'number' ||
      isNaN(selectedLocation.latitude) ||
      isNaN(selectedLocation.longitude) ||
      selectedLocation.latitude < -90 ||
      selectedLocation.latitude > 90 ||
      selectedLocation.longitude < -180 ||
      selectedLocation.longitude > 180
    ) {
      errors.location = 'Please select a valid location on the map.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevent double submission

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStage('creating');
    setUploadWarnings([]);
    setFormErrors({});

    try {
      const resolvedIssueTitle = resolveTitle(title, description, categoryId);

      // 1. Create the issue via backend API
      const newIssue = await issuesApi.create({
        title: resolvedIssueTitle,
        description: description.trim(),
        categoryId,
        latitude: Number(selectedLocation.latitude.toFixed(6)),
        longitude: Number(selectedLocation.longitude.toFixed(6)),
        locationLabel: landmark.trim() || undefined,
        landmark: landmark.trim() || undefined,
      });

      setCreatedIssue(newIssue);

      // 2. Upload photos if any were selected
      if (selectedFiles.length > 0) {
        setSubmitStage('uploading');
        const warnings: string[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          setUploadProgress({ current: i + 1, total: selectedFiles.length });
          const file = selectedFiles[i];
          const isPrimary = i === 0;

          try {
            await issuesApi.uploadImage(newIssue.id, file, isPrimary);
          } catch (uploadErr: unknown) {
            const errorMsg =
              uploadErr instanceof Error
                ? uploadErr.message
                : `Photo "${file.name}" failed to upload.`;
            warnings.push(errorMsg);
          }
        }

        if (warnings.length > 0) {
          setUploadWarnings(warnings);
        }
      }

      // 3. Mark success
      setSubmitStage('success');
    } catch (err: unknown) {
      setIsSubmitting(false);
      setSubmitStage('idle');

      let errorMessage = 'We could not submit your issue. Please try again.';
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setFormErrors({ general: errorMessage });
    }
  };

  // Selected Category Object
  const selectedCatObj = categories.find((c) => c.id === categoryId);

  // Success Confirmation Screen
  if (submitStage === 'success' && createdIssue) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 animate-in fade-in duration-300">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
          {/* Animated Success Icon */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <IconCheckCircle size={36} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Your issue has been reported.
            </h2>
            <p className="text-sm text-slate-300">
              Thank you for keeping our community and campus safe and functional.
            </p>
          </div>

          {/* Issue Details Card */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/70 text-left space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <span className="text-xs text-slate-400 font-medium">Issue Reference</span>
              <span className="font-mono text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                Issue #{createdIssue.issueNumber}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Category:</span>
                <span className="font-semibold text-slate-200">
                  {createdIssue.category?.name || selectedCatObj?.name || 'Civic Issue'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Initial Status:</span>
                <span className="font-semibold text-amber-400">REPORTED</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Photos Attached:</span>
                <span className="font-semibold text-slate-200">
                  {selectedFiles.length - uploadWarnings.length} of {selectedFiles.length}
                </span>
              </div>
            </div>
          </div>

          {/* Upload Warnings (if partial failure) */}
          {uploadWarnings.length > 0 && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs text-left space-y-1.5"
            >
              <div className="flex items-center gap-2 font-semibold">
                <IconAlertCircle size={16} />
                <span>Notice: Some photos could not be uploaded</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Your report was successfully submitted. You can attach additional photos later from the issue details page.
              </p>
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/issues/${createdIssue.id}`)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <span>View Issue Details</span>
              <IconArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition-colors"
            >
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-200 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">Report an Issue</span>
      </nav>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 shadow-md space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          <span>Campus &amp; Community Intake</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Report an Issue
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
          Help your campus/community identify and resolve local issues.
          Fill out the details below and pinpoint the defect location for direct routing.
        </p>
      </div>

      {/* General Submission Error Banner */}
      {formErrors.general && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-3 animate-in fade-in"
        >
          <IconAlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-200">Unable to Submit Report</p>
            <p>{formErrors.general}</p>
          </div>
        </div>
      )}

      {/* Report Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Category, Description, Photos (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Category Selection Card */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="issue-category"
                  className="text-sm font-bold text-white flex items-center gap-2"
                >
                  <IconTag size={16} className="text-indigo-400" />
                  <span>Issue Category <span className="text-rose-400">*</span></span>
                </label>
                {isLoadingCategories && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <IconRefresh size={12} className="animate-spin" />
                    <span>Loading categories...</span>
                  </span>
                )}
              </div>

              {categoryError ? (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between gap-3">
                  <span>{categoryError}</span>
                  <button
                    type="button"
                    onClick={loadCategories}
                    className="inline-flex items-center gap-1 text-xs font-semibold underline text-amber-200 hover:text-white"
                  >
                    <IconRefresh size={12} />
                    <span>Retry</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    id="issue-category"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      if (formErrors.categoryId) {
                        setFormErrors((prev) => ({ ...prev, categoryId: undefined }));
                      }
                    }}
                    disabled={isSubmitting || isLoadingCategories}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-950 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                      formErrors.categoryId
                        ? 'border-rose-500/80 ring-1 ring-rose-500/40'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                    aria-required="true"
                    aria-invalid={Boolean(formErrors.categoryId)}
                    aria-describedby={formErrors.categoryId ? 'category-error' : undefined}
                  >
                    <option value="" disabled>
                      -- Select an issue category --
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  {formErrors.categoryId && (
                    <p id="category-error" className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                      <IconAlertCircle size={13} />
                      <span>{formErrors.categoryId}</span>
                    </p>
                  )}

                  {selectedCatObj && selectedCatObj.description && (
                    <p className="text-xs text-slate-400 leading-relaxed px-1">
                      {selectedCatObj.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Description & Title Card */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-5">
              {/* Optional Issue Title / Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="issue-title"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Title / Short Summary <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {title.length}/200
                  </span>
                </div>
                <input
                  id="issue-title"
                  type="text"
                  maxLength={200}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (formErrors.title) {
                      setFormErrors((prev) => ({ ...prev, title: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  placeholder="e.g., Water leakage outside Tech Park block"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-950 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    formErrors.title
                      ? 'border-rose-500/80 ring-1 ring-rose-500/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
                {formErrors.title && (
                  <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                    <IconAlertCircle size={13} />
                    <span>{formErrors.title}</span>
                  </p>
                )}
              </div>

              {/* Required Issue Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="issue-description"
                    className="text-sm font-bold text-white flex items-center gap-2"
                  >
                    <IconFileText size={16} className="text-indigo-400" />
                    <span>Issue Description <span className="text-rose-400">*</span></span>
                  </label>
                  <span className="text-xs text-slate-500 font-mono">
                    {description.length} / 3000
                  </span>
                </div>

                <textarea
                  id="issue-description"
                  rows={5}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (formErrors.description) {
                      setFormErrors((prev) => ({ ...prev, description: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  placeholder="Describe the issue clearly. Include useful details such as what happened, where it is, and how it affects people."
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-950 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors leading-relaxed resize-y ${
                    formErrors.description
                      ? 'border-rose-500/80 ring-1 ring-rose-500/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                  aria-required="true"
                  aria-invalid={Boolean(formErrors.description)}
                  aria-describedby={formErrors.description ? 'desc-error' : undefined}
                />

                {formErrors.description && (
                  <p id="desc-error" className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                    <IconAlertCircle size={13} />
                    <span>{formErrors.description}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Photo Upload Card */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Attach Photos</span>
                  <span className="text-xs text-slate-500 font-normal">(Optional, up to 5)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Photos significantly speed up department triage and verification.
                </p>
              </div>

              <ImageUploader
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                maxFiles={5}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Right Column: Location Section (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <IconMapPin size={18} className="text-rose-400" />
                  <span>Where is the issue? <span className="text-rose-400">*</span></span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Move the marker or tap the map to select the exact issue location.
                </p>
              </div>

              {/* Location Map Picker */}
              <LocationPicker
                value={selectedLocation}
                onChange={(coords) => {
                  setSelectedLocation(coords);
                  if (formErrors.location) {
                    setFormErrors((prev) => ({ ...prev, location: undefined }));
                  }
                }}
                height="h-[380px]"
              />

              {formErrors.location && (
                <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                  <IconAlertCircle size={13} />
                  <span>{formErrors.location}</span>
                </p>
              )}

              {/* Optional Landmark / Room Details */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label
                  htmlFor="landmark-input"
                  className="text-xs font-semibold text-slate-300"
                >
                  Landmark or Room/Avenue Details <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  id="landmark-input"
                  type="text"
                  maxLength={300}
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g., Near Hostel 3 Gate, 2nd floor walkway"
                  className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Submission Button */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <IconChevronLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>

          <div className="w-full sm:w-auto flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || isLoadingCategories}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md shadow-indigo-600/25 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <IconRefresh size={16} className="animate-spin" />
                  <span>
                    {submitStage === 'creating' && 'Creating issue...'}
                    {submitStage === 'uploading' &&
                      `Uploading photos (${uploadProgress.current}/${uploadProgress.total})...`}
                    {submitStage === 'idle' && 'Submitting...'}
                  </span>
                </>
              ) : (
                <>
                  <span>Submit Issue</span>
                  <IconArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
