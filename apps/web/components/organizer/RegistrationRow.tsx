import type { RegistrationWithUser, RegistrationStatus } from "@spotter/types";
import { REGISTRATION_STATUSES } from "@spotter/types";

interface RegistrationRowProps {
  registration: RegistrationWithUser;
  compact?: boolean;
  showCheckIn?: boolean;
  onCheckIn?: () => void;
}

export function RegistrationRow({
  registration,
  compact = false,
  showCheckIn = false,
  onCheckIn,
}: RegistrationRowProps) {
  const getStatusColor = (status: RegistrationStatus) => {
    const colors: Record<RegistrationStatus, string> = {
      registered: "bg-gray-100 text-gray-800",
      waitlisted: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      checked_in: "bg-blue-100 text-blue-800",
      no_show: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-500",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPaymentStatusColor = (status: typeof registration.paymentStatus) => {
    const colors = {
      pending: "text-yellow-600",
      paid: "text-green-600",
      waived: "text-blue-600",
      refunded: "text-gray-500",
    };
    return colors[status] || "text-gray-600";
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const displayName = registration.displayName || registration.guestName || "Anonymous";
  const email = registration.email || registration.guestEmail || "-";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (compact) {
    return (
      <div className="py-3 flex items-center space-x-3">
        <div className="flex-shrink-0">
          {registration.avatarUrl ? (
            <img
              src={registration.avatarUrl}
              alt={displayName}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
          <p className="text-xs text-gray-500 truncate">{email}</p>
        </div>
        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(registration.status)}`}>
          {REGISTRATION_STATUSES.find((s) => s.value === registration.status)?.label}
        </span>
      </div>
    );
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            {registration.avatarUrl ? (
              <img
                src={registration.avatarUrl}
                alt={displayName}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                {initials}
              </div>
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{displayName}</div>
            <div className="text-sm text-gray-500">{email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(registration.status)}`}>
          {REGISTRATION_STATUSES.find((s) => s.value === registration.status)?.label}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`text-sm ${getPaymentStatusColor(registration.paymentStatus)}`}>
          {registration.paymentStatus.charAt(0).toUpperCase() + registration.paymentStatus.slice(1)}
        </div>
        {registration.amountPaidCents && (
          <div className="text-sm text-gray-500">${(registration.amountPaidCents / 100).toFixed(2)}</div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(registration.registeredAt)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          {showCheckIn && onCheckIn && (
            <button
              onClick={onCheckIn}
              className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Check In
            </button>
          )}
          <button className="text-indigo-600 hover:text-indigo-900">Edit</button>
          {registration.status !== "cancelled" && (
            <button className="text-red-600 hover:text-red-900">Cancel</button>
          )}
        </div>
      </td>
    </tr>
  );
}
