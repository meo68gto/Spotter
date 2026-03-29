import { getSession } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getSponsors(organizerId: string) {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('sponsors')
    .select(`
      id,
      name,
      contact_name,
      contact_email,
      tier,
      is_active,
      logo_url,
      website_url,
      created_at,
      sponsor_contracts(count)
    `)
    .eq('organizer_id', organizerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return { data, error }
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-200 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  custom: 'bg-purple-100 text-purple-800',
}

const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  custom: 'Custom',
}

export default async function SponsorsPage() {
  const session = await getSession()

  if (!session || (session.role !== 'operator' && session.role !== 'admin')) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500">Operator access required.</p>
        </div>
      </div>
    )
  }

  const { data: sponsors, error } = await getSponsors(session.organizerId!)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sponsors</h1>
          <p className="text-gray-500 mt-1">{sponsors?.length ?? 0} active sponsors</p>
        </div>
        <Link
          href="/sponsors/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Sponsor
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
          Error loading sponsors: {error.message}
        </div>
      )}

      {(!sponsors || sponsors.length === 0) ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No sponsors yet</h3>
          <p className="text-gray-500 text-sm mb-4">Add your first sponsor to get started.</p>
          <Link href="/sponsors/new" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            + Add your first sponsor
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sponsor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contracts</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sponsors.map(sponsor => {
                const contractCount = (sponsor as any).sponsor_contracts?.[0]?.count ?? 0
                return (
                  <tr key={sponsor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {sponsor.logo_url ? (
                          <img src={sponsor.logo_url} alt={sponsor.name} className="w-10 h-10 rounded object-contain" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                            {sponsor.name.charAt(0)}
                          </div>
                        )}
                        <div className="ml-4">
                          <Link href={`/sponsors/${sponsor.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600">
                            {sponsor.name}
                          </Link>
                          {sponsor.website_url && (
                            <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-indigo-600 ml-1">
                              ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{sponsor.contact_name ?? '—'}</div>
                      <div className="text-xs text-gray-500">{sponsor.contact_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${TIER_COLORS[sponsor.tier] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIER_LABELS[sponsor.tier] ?? sponsor.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contractCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        sponsor.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {sponsor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link href={`/sponsors/${sponsor.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
