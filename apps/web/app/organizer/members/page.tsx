"use client";

import { useState } from "react";
import { MemberRow } from "../../../components/organizer/MemberRow";
import type { OrganizerMemberWithUser, OrganizerRole } from "@spotter/types";
import { ORGANIZER_ROLES } from "@spotter/types";

// Mock data - would come from API in production
const mockMembers: OrganizerMemberWithUser[] = [
  {
    id: "member-1",
    organizerId: "org-1",
    userId: "user-1",
    role: "owner",
    displayName: "John Doe",
    email: "john@example.com",
    avatarUrl: undefined,
    joinedAt: "2024-01-15T10:00:00Z",
    addedByUserId: "user-1",
    accepted: true,
    acceptedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "member-2",
    organizerId: "org-1",
    userId: "user-2",
    role: "admin",
    displayName: "Jane Smith",
    email: "jane@example.com",
    avatarUrl: undefined,
    joinedAt: "2024-02-01T14:30:00Z",
    addedByUserId: "user-1",
    accepted: true,
    acceptedAt: "2024-02-01T15:00:00Z",
  },
  {
    id: "member-3",
    organizerId: "org-1",
    userId: "user-3",
    role: "manager",
    displayName: "Bob Johnson",
    email: "bob@example.com",
    avatarUrl: undefined,
    joinedAt: "2024-02-15T09:00:00Z",
    addedByUserId: "user-2",
    accepted: true,
    acceptedAt: "2024-02-15T10:00:00Z",
  },
  {
    id: "member-4",
    organizerId: "org-1",
    userId: "user-4",
    role: "viewer",
    displayName: "Alice Williams",
    email: "alice@example.com",
    avatarUrl: undefined,
    joinedAt: "2024-03-01T11:00:00Z",
    addedByUserId: "user-2",
    accepted: false,
  },
  {
    id: "member-5",
    organizerId: "org-1",
    userId: "user-5",
    role: "manager",
    displayName: "Charlie Brown",
    email: "charlie@example.com",
    avatarUrl: undefined,
    joinedAt: "2024-03-10T16:00:00Z",
    addedByUserId: "user-1",
    accepted: true,
    acceptedAt: "2024-03-10T17:00:00Z",
  },
];

export default function MembersPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizerRole>("viewer");
  const [roleFilter, setRoleFilter] = useState<OrganizerRole | "all">("all");

  const filteredMembers = mockMembers.filter((member) => {
    if (roleFilter === "all") return true;
    return member.role === roleFilter;
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setShowInviteModal(false);
    setInviteEmail("");
    alert(`Invitation sent to ${inviteEmail} as ${inviteRole}`);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert(`Member ${memberId} removed`);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: OrganizerRole) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    alert(`Changed member ${memberId} role to ${newRole}`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-600">Manage your team and their access levels.</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Invite Member
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as OrganizerRole | "all")}
              className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            >
              <option value="all">All Roles</option>
              {ORGANIZER_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 text-right text-sm text-gray-500">
            {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onRemove={() => handleRemoveMember(member.id)}
                onChangeRole={(role) => handleChangeRole(member.id, role)}
              />
            ))}
          </tbody>
        </table>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No members found</h3>
            <p className="mt-1 text-sm text-gray-500">Invite team members to collaborate.</p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Invite Member</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleInvite} className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  placeholder="colleague@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="inviteRole" className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizerRole)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                >
                  {ORGANIZER_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
                <p className="font-medium mb-1">Permissions for this role:</p>
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(
                    ORGANIZER_ROLES.find((r) => r.value === inviteRole)?.defaultPermissions || {}
                  ).map(([key, value]) => (
                    <li key={key} className={value ? "text-green-700" : "text-gray-400"}>
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}:{" "}
                      {value ? "Yes" : "No"}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
