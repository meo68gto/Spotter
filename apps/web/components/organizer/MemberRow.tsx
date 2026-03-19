import { useState } from "react";
import type { OrganizerMemberWithUser, OrganizerRole } from "@spotter/types";
import { ORGANIZER_ROLES } from "@spotter/types";

interface MemberRowProps {
  member: OrganizerMemberWithUser;
  onRemove: () => void;
  onChangeRole: (role: OrganizerRole) => void;
}

export function MemberRow({ member, onRemove, onChangeRole }: MemberRowProps) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const initials = member.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleColor = (role: OrganizerRole) => {
    const colors: Record<OrganizerRole, string> = {
      owner: "bg-purple-100 text-purple-800",
      admin: "bg-blue-100 text-blue-800",
      manager: "bg-green-100 text-green-800",
      viewer: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt={member.displayName} className="h-10 w-10 rounded-full" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                {initials}
              </div>
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{member.displayName}</div>
            <div className="text-sm text-gray-500">{member.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            disabled={member.role === "owner"}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
              member.role
            )} ${member.role === "owner" ? "cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
          >
            {ORGANIZER_ROLES.find((r) => r.value === member.role)?.label}
            {member.role !== "owner" && (
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {showRoleDropdown && member.role !== "owner" && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowRoleDropdown(false)}
              />
              <ul className="absolute z-20 mt-1 w-40 bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                {ORGANIZER_ROLES.filter((r) => r.value !== "owner").map((role) => (
                  <li
                    key={role.value}
                    onClick={() => {
                      onChangeRole(role.value);
                      setShowRoleDropdown(false);
                    }}
                    className={`cursor-pointer select-none relative py-2 px-4 hover:bg-gray-100 ${
                      member.role === role.value ? "bg-gray-50" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="font-medium block truncate">{role.label}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {member.accepted ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Active
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(member.joinedAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {member.role !== "owner" && (
          <button onClick={onRemove} className="text-red-600 hover:text-red-900">
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}
