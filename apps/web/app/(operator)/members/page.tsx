'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemberUser {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Member {
  id: string;
  role: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
  users: MemberUser | MemberUser[] | null;
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  owner:   { label: 'Owner',   bg: 'bg-purple-100', text: 'text-purple-700' },
  admin:   { label: 'Admin',   bg: 'bg-red-100',    text: 'text-red-700' },
  manager: { label: 'Manager', bg: 'bg-blue-100',   text: 'text-blue-700' },
  viewer:  { label: 'Viewer',   bg: 'bg-gray-100',   text: 'text-gray-600' },
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, bg: 'bg-gray-100', text: 'text-gray-600' };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].substring(0, 2);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operator/members');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data = await res.json();
      setMembers(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filtered = members.filter((m) => {
    const user = Array.isArray(m.users) ? m.users[0] : m.users;
    const matchesActive = filter === 'all' || (filter === 'active' && m.is_active) || (filter === 'inactive' && !m.is_active);
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const matchesSearch = !search.trim() ||
      (user?.display_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (user?.email ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesActive && matchesRole && matchesSearch;
  });

  const activeCount = members.filter(m => m.is_active).length;
  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {loading ? 'Loading...' : `${activeCount} active member${activeCount !== 1 ? 's' : ''} across ${Object.keys(roleCounts).length} roles`}
          </p>
        </div>
        <button
          onClick={() => {/* invite modal — future */}}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Invite Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']] as [string, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val as any)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filter === val ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="all">All Roles</option>
          {Object.entries(roleCounts).map(([role]) => (
            <option key={role} value={role}>{ROLE_CONFIG[role]?.label ?? role}</option>
          ))}
        </select>
      </div>

      {/* Role summary chips */}
      {!loading && Object.keys(roleCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(roleCounts).map(([role, count]) => {
            const st = getRoleConfig(role);
            return (
              <span key={role} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                {st.label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchMembers} className="text-xs text-red-600 hover:underline mt-1">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-2 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !error && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-gray-500 font-medium">No members found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or invite a team member</p>
        </div>
      )}

      {/* Member list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((member) => {
            const user = Array.isArray(member.users) ? member.users[0] : member.users;
            const st = getRoleConfig(member.role);

            return (
              <div
                key={member.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  member.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    member.is_active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {getInitials(user?.display_name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {user?.display_name ?? 'Unknown User'}
                      </p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                      {!member.is_active && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    {user?.email && (
                      <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-xs text-gray-500">
                      Joined {member.joined_at ? fmtDate(member.joined_at) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Invited {fmtDate(member.invited_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {member.role !== 'owner' && member.is_active && (
                      <button
                        onClick={() => {/* deactivate */}}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deactivate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                    )}
                    {member.role !== 'owner' && !member.is_active && (
                      <button
                        onClick={() => {/* reactivate */}}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Reactivate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
