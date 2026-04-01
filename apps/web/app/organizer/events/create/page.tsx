"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EventType, OrganizerTier } from "@spotter/types";
import { EVENT_TYPES, ORGANIZER_TIERS } from "@spotter/types";

// Mock golf courses - would come from API
const mockCourses = [
  { id: "course-1", name: "Pine Valley Golf Club", city: "Pine Valley", state: "NJ" },
  { id: "course-2", name: "Oakmont Country Club", city: "Oakmont", state: "PA" },
  { id: "course-3", name: "Pebble Beach Golf Links", city: "Pebble Beach", state: "CA" },
  { id: "course-4", name: "Augusta National Golf Club", city: "Augusta", state: "GA" },
  { id: "course-5", name: "St Andrews Links", city: "St Andrews", state: "Fife" },
];

export default function CreateEventPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<typeof mockCourses[0] | null>(null);

  // EPIC 7 / EPIC 11: Check if user can create exclusive (SUMMIT-only) events
  // In production, this would come from the user's session/tier context
  const canCreateExclusiveEvents = true; // TODO: wire to hasAccess(userTier, 'createExclusiveEvents')
  const [exclusiveEventEnabled, setExclusiveEventEnabled] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "tournament" as EventType,
    courseId: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    registrationOpensDate: "",
    registrationOpensTime: "",
    registrationClosesDate: "",
    registrationClosesTime: "",
    maxParticipants: "",
    entryFee: "",
    isPublic: true,
    targetTiers: {
      bronze: true,
      silver: true,
      gold: true,
    } as Record<OrganizerTier, boolean>,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const courseRef = useRef<HTMLInputElement | null>(null);
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const maxParticipantsRef = useRef<HTMLInputElement | null>(null);
  const targetTiersRef = useRef<HTMLDivElement | null>(null);

  const filteredCourses = mockCourses.filter(
    (course) =>
      course.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.city.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const focusField = (field: string) => {
    const target =
      {
        title: titleRef.current,
        course: courseRef.current,
        startTime: startDateRef.current,
        endTime: endDateRef.current,
        maxParticipants: maxParticipantsRef.current,
        targetTiers: targetTiersRef.current,
      }[field] ?? summaryRef.current;

    target?.focus();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let firstErrorField: string | null = null;

    const addError = (field: string, message: string) => {
      newErrors[field] = message;
      if (!firstErrorField) firstErrorField = field;
    };

    if (!formData.title.trim()) {
      addError("title", "Event name is required");
    }

    if (!selectedCourse) {
      addError("course", "Please select a golf course");
    }

    if (!formData.startDate || !formData.startTime) {
      addError("startTime", "Start date and time are required");
    }

    if (!formData.endDate || !formData.endTime) {
      addError("endTime", "End date and time are required");
    }

    if (!formData.maxParticipants || parseInt(formData.maxParticipants) < 1) {
      addError("maxParticipants", "Maximum participants must be at least 1");
    }

    const selectedTiers = Object.entries(formData.targetTiers).filter(([_, v]) => v);
    if (selectedTiers.length === 0) {
      addError("targetTiers", "At least one tier must be selected");
    }

    // EPIC 7 / EPIC 11: Validate exclusive event creation
    if (exclusiveEventEnabled && !canCreateExclusiveEvents) {
      addError("exclusiveEvent", "Only SUMMIT members can create exclusive events");
    }

    setErrors(newErrors);
    if (firstErrorField) {
      window.requestAnimationFrame(() => focusField(firstErrorField as string));
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, publish: boolean) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitAttempted(true);

    if (!validateForm()) return;

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // In production, this would call the API
    console.log("Creating event:", {
      ...formData,
      courseId: selectedCourse?.id,
      status: publish ? "published" : "draft",
    });

    setIsSubmitting(false);
    router.push("/organizer/events");
  };

  const handleCourseSelect = (course: typeof mockCourses[0]) => {
    setSelectedCourse(course);
    setCourseSearch(course.name);
    setShowCourseDropdown(false);
    clearFieldError("course");
    setFormData((prev) => ({ ...prev, courseId: course.id }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/organizer/events" className="hover:text-gray-700">
          Events
        </Link>
        <span>/</span>
        <span className="text-gray-900">Create Event</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
        <p className="text-gray-600">Set up your tournament, scramble, or social event.</p>
      </div>

      <form className="space-y-8" noValidate>
        {submitAttempted && Object.keys(errors).length > 0 && (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Please fix the highlighted fields before continuing.
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Event Name *
              </label>
              <input
                ref={titleRef}
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, title: e.target.value }));
                  clearFieldError("title");
                }}
                aria-invalid={errors.title ? "true" : "false"}
                aria-describedby={errors.title ? "title-error" : undefined}
                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm border p-2 ${
                  errors.title ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                }`}
                placeholder="e.g., Spring Championship Tournament"
              />
              {errors.title && <p id="title-error" className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                placeholder="Describe your event..."
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Event Type *
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as EventType }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Course Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Course *</h2>

          <div className="relative">
            <input
              ref={courseRef}
              type="text"
              value={courseSearch}
              onChange={(e) => {
                setCourseSearch(e.target.value);
                setShowCourseDropdown(true);
                clearFieldError("course");
                if (!e.target.value) {
                  setSelectedCourse(null);
                  setFormData((prev) => ({ ...prev, courseId: "" }));
                }
              }}
              onFocus={() => setShowCourseDropdown(true)}
              aria-invalid={errors.course ? "true" : "false"}
              aria-describedby={errors.course ? "course-error" : undefined}
              placeholder="Search for a golf course..."
              className={`block w-full rounded-md shadow-sm sm:text-sm border p-2 ${
                errors.course ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {showCourseDropdown && filteredCourses.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                {filteredCourses.map((course) => (
                  <li
                    key={course.id}
                    onClick={() => handleCourseSelect(course)}
                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50"
                  >
                    <div className="flex items-center">
                      <span className="font-normal block truncate">{course.name}</span>
                    </div>
                    <span className="text-gray-500 text-sm">
                      {course.city}, {course.state}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errors.course && <p id="course-error" className="mt-1 text-sm text-red-600">{errors.course}</p>}
        </div>

        {/* Date and Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Date & Time</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date & Time *</label>
              <div className="mt-1 flex space-x-2">
                <input
                  ref={startDateRef}
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, startDate: e.target.value }));
                    clearFieldError("startTime");
                  }}
                  aria-invalid={errors.startTime ? "true" : "false"}
                  aria-describedby={errors.startTime ? "startTime-error" : undefined}
                  className={`block w-full rounded-md border shadow-sm sm:text-sm p-2 ${
                    errors.startTime ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                />
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, startTime: e.target.value }));
                    clearFieldError("startTime");
                  }}
                  aria-invalid={errors.startTime ? "true" : "false"}
                  aria-describedby={errors.startTime ? "startTime-error" : undefined}
                  className={`block w-32 rounded-md border shadow-sm sm:text-sm p-2 ${
                    errors.startTime ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                />
              </div>
              {errors.startTime && <p id="startTime-error" className="mt-1 text-sm text-red-600">{errors.startTime}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Date & Time *</label>
              <div className="mt-1 flex space-x-2">
                <input
                  ref={endDateRef}
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, endDate: e.target.value }));
                    clearFieldError("endTime");
                  }}
                  aria-invalid={errors.endTime ? "true" : "false"}
                  aria-describedby={errors.endTime ? "endTime-error" : undefined}
                  className={`block w-full rounded-md border shadow-sm sm:text-sm p-2 ${
                    errors.endTime ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                />
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, endTime: e.target.value }));
                    clearFieldError("endTime");
                  }}
                  aria-invalid={errors.endTime ? "true" : "false"}
                  aria-describedby={errors.endTime ? "endTime-error" : undefined}
                  className={`block w-32 rounded-md border shadow-sm sm:text-sm p-2 ${
                    errors.endTime ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                />
              </div>
              {errors.endTime && <p id="endTime-error" className="mt-1 text-sm text-red-600">{errors.endTime}</p>}
            </div>
          </div>
        </div>

        {/* Registration Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Registration Settings</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Registration Opens</label>
                <div className="mt-1 flex space-x-2">
                  <input
                    type="date"
                    value={formData.registrationOpensDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registrationOpensDate: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                  <input
                    type="time"
                    value={formData.registrationOpensTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registrationOpensTime: e.target.value }))}
                    className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Registration Closes</label>
                <div className="mt-1 flex space-x-2">
                  <input
                    type="date"
                    value={formData.registrationClosesDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registrationClosesDate: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                  <input
                    type="time"
                    value={formData.registrationClosesTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registrationClosesTime: e.target.value }))}
                    className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700">
                  Maximum Participants *
                </label>
                <input
                  ref={maxParticipantsRef}
                  type="number"
                  id="maxParticipants"
                  min="1"
                  value={formData.maxParticipants}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, maxParticipants: e.target.value }));
                    clearFieldError("maxParticipants");
                  }}
                  aria-invalid={errors.maxParticipants ? "true" : "false"}
                  aria-describedby={errors.maxParticipants ? "maxParticipants-error" : undefined}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm border p-2 ${
                    errors.maxParticipants ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  }`}
                />
                {errors.maxParticipants && <p id="maxParticipants-error" className="mt-1 text-sm text-red-600">{errors.maxParticipants}</p>}
              </div>

              <div>
                <label htmlFor="entryFee" className="block text-sm font-medium text-gray-700">
                  Entry Fee ($)
                </label>
                <input
                  type="number"
                  id="entryFee"
                  min="0"
                  step="0.01"
                  value={formData.entryFee}
                  onChange={(e) => setFormData((prev) => ({ ...prev, entryFee: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Visibility</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Visibility</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={() => setFormData((prev) => ({ ...prev, isPublic: true }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Public - Anyone can see and register</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="isPublic"
                    checked={!formData.isPublic}
                    onChange={() => setFormData((prev) => ({ ...prev, isPublic: false }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Invite-only - Only invited members can see</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Tiers *</label>
              <p className="text-sm text-gray-500 mb-2">Which member tiers can see this event?</p>
              <div
                ref={targetTiersRef}
                tabIndex={-1}
                role="group"
                aria-describedby={errors.targetTiers ? "targetTiers-error" : undefined}
                className="flex flex-wrap gap-4"
              >
                {ORGANIZER_TIERS.map((tier) => (
                  <label key={tier.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.targetTiers[tier.value]}
                      onChange={(e) => {
                        clearFieldError("targetTiers");
                        setFormData((prev) => ({
                          ...prev,
                          targetTiers: { ...prev.targetTiers, [tier.value]: e.target.checked },
                        }));
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{tier.label}</span>
                  </label>
                ))}
              </div>
              {errors.targetTiers && <p id="targetTiers-error" className="mt-1 text-sm text-red-600">{errors.targetTiers}</p>}
            </div>

            {/*
              EPIC 7 / EPIC 11: Exclusive Event Toggle
              Only available to SUMMIT members (createExclusiveEvents = true)
              When enabled, event is visible only to other SUMMIT members
            */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    💎 Exclusive SUMMIT Event
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    Only visible to SUMMIT members. Requires SUMMIT membership.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {exclusiveEventEnabled && !canCreateExclusiveEvents && (
                    <span className="text-sm text-red-600">🔒 Requires SUMMIT</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (exclusiveEventEnabled || canCreateExclusiveEvents) {
                        setExclusiveEventEnabled(!exclusiveEventEnabled);
                      }
                    }}
                    disabled={!canCreateExclusiveEvents && !exclusiveEventEnabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      exclusiveEventEnabled
                        ? 'bg-amber-500'
                        : 'bg-gray-200'
                    } ${!canCreateExclusiveEvents && !exclusiveEventEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        exclusiveEventEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              {exclusiveEventEnabled && (
                <p className="text-sm text-amber-600 mt-2">
                  👁️ This event will only be visible to SUMMIT members
                </p>
              )}
              {errors.exclusiveEvent && (
                <p className="text-sm text-red-600 mt-2">{errors.exclusiveEvent}</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/organizer/events"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            disabled={isSubmitting}
            className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Publishing..." : "Publish Event"}
          </button>
        </div>
      </form>
    </div>
  );
}
