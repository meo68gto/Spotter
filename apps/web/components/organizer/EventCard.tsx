import type { OrganizerEvent, EventStatus } from "@spotter/types";
import { EVENT_STATUSES, EVENT_TYPES } from "@spotter/types";

interface EventCardProps {
  event: OrganizerEvent;
  onClick?: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const getStatusColor = (status: EventStatus) => {
    const colors: Record<EventStatus, string> = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-blue-100 text-blue-800",
      registration_open: "bg-green-100 text-green-800",
      full: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getTypeIcon = (type: typeof event.type) => {
    const icons: Record<typeof event.type, string> = {
      tournament: "🏆",
      scramble: "⛳",
      charity: "💝",
      corporate: "💼",
      social: "🎉",
    };
    return icons[type] || "⛳";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const registrationPercentage = Math.round((event.registrationCount / event.maxParticipants) * 100);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getTypeIcon(event.type)}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
              <p className="text-sm text-gray-500">{event.courseName}</p>
            </div>
          </div>
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
            {EVENT_STATUSES.find((s) => s.value === event.status)?.label}
          </span>
        </div>

        <div className="mt-4 flex items-center text-sm text-gray-500 space-x-4">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(event.startTime)}
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(event.startTime)}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {event.registrationCount} / {event.maxParticipants} registered
            </span>
            <span className="text-gray-900 font-medium">{registrationPercentage}%</span>
          </div>
          <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                registrationPercentage >= 90 ? "bg-red-500" : registrationPercentage >= 70 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${registrationPercentage}%` }}
            />
          </div>
        </div>

        {event.waitlistCount > 0 && (
          <div className="mt-3 text-sm text-yellow-600">{event.waitlistCount} on waitlist</div>
        )}

        {event.entryFeeCents && (
          <div className="mt-3 flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ${(event.entryFeeCents / 100).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
