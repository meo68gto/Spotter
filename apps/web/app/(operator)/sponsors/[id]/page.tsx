import { getSession } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function getSponsorWithDetails(sponsorId: string, organizerId: string) {
  const supabase = createServerClient()

  const { data: sponsor, error } = await supabase
    .from('sponsors')
    .select('*')
    .eq('id', sponsorId)
    .eq('organizer_id', organizerId)
    .single()

  if (error || !sponsor) return null

  const { data: contracts } = await supabase
    .from('sponsor_contracts')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .order('created_at', { ascending: false })

  const contractIds = contracts?.map(c => c.id) ?? []

  let fulfillment: any[] = []
  if (contractIds.length) {
    const { data } = await supabase
      .from('sponsor_fulfillment')
      .select('*')
      .in('contract_id', contractIds)
      .order('created_at', { ascending: false })
    fulfillment = data ?? []
  }

  return { sponsor, contracts: contracts ?? [], fulfillment }
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

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-indigo-100 text-indigo-700',
  signed: 'bg-green-100 text-green-700',
  active: 'bg-indigo-100 text-indigo-700',
  expired: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
}

const FULFILLMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  missed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  missed: 'Missed',
}

export default async function SponsorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()

  if (!session || (session.role !== 'operator' && session.role !== 'admin') || !session.organizerId) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500">Operator access required.</p>
        </div>
      </div>
    )
  }

  const result = await getSponsorWithDetails(id, session.organizerId)

  if (!result) {
    notFound()
  }

  const { sponsor, contracts, fulfillment } = result

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/sponsors" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
          ← Back to Sponsors
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {sponsor.logo_url ? (
              <img src={sponsor.logo_url} alt={sponsor.name} className="w-16 h-16 rounded-lg object-contain border border-gray-200" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700">
                {sponsor.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{sponsor.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${TIER_COLORS[sponsor.tier] ?? 'bg-gray-100'}`}>
                  {TIER_LABELS[sponsor.tier] ?? sponsor.tier} Sponsor
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${sponsor.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {sponsor.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <Link
            href={`/sponsors/${id}/edit`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
          >
            Edit Sponsor
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Contact + Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h3>
            <dl className="space-y-3">
              {sponsor.contact_name && (
                <>
                  <dt className="text-xs text-gray-500">Name</dt>
                  <dd className="text-sm text-gray-900">{sponsor.contact_name}</dd>
                </>
              )}
              <dt className="text-xs text-gray-500">Email</dt>
              <dd className="text-sm">
                <a href={`mailto:${sponsor.contact_email}`} className="text-indigo-600 hover:text-indigo-800">
                  {sponsor.contact_email}
                </a>
              </dd>
              {sponsor.contact_phone && (
                <>
                  <dt className="text-xs text-gray-500">Phone</dt>
                  <dd className="text-sm text-gray-900">{sponsor.contact_phone}</dd>
                </>
              )}
              {sponsor.website_url && (
                <>
                  <dt className="text-xs text-gray-500">Website</dt>
                  <dd className="text-sm">
                    <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                      {sponsor.website_url.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>

          {sponsor.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{sponsor.notes}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Stats</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">Contracts</dt>
                <dd className="text-sm font-medium">{contracts.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">Active</dt>
                <dd className="text-sm font-medium">{contracts.filter((c: any) => c.status === 'active').length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">Total Value</dt>
                <dd className="text-sm font-medium">
                  ${contracts.reduce((sum: number, c: any) => sum + (c.value_cents ?? 0), 0) / 100}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right: Contracts + Fulfillment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contracts */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Contracts</h3>
              <Link
                href={`/sponsors/${id}/contracts/new`}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add Contract
              </Link>
            </div>
            {contracts.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No contracts yet. Add one to start tracking sponsor obligations.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {contracts.map((contract: any) => {
                  const contractFulfillment = fulfillment.filter((f: any) => f.contract_id === contract.id)
                  const completedCount = contractFulfillment.filter((f: any) => f.status === 'completed').length

                  return (
                    <div key={contract.id} className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{contract.name}</h4>
                          {contract.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{contract.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${CONTRACT_STATUS_COLORS[contract.status] ?? 'bg-gray-100'}`}>
                            {STATUS_LABELS[contract.status] ?? contract.status}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            ${((contract.value_cents ?? 0) / 100).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Fulfillment checklist */}
                      {contractFulfillment.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-gray-100 space-y-2">
                          <p className="text-xs text-gray-500 font-medium">
                            Fulfillment ({completedCount}/{contractFulfillment.length})
                          </p>
                          {contractFulfillment.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                item.status === 'completed' ? 'bg-green-500' :
                                item.status === 'missed' ? 'bg-red-500' :
                                item.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'
                              }`} />
                              <span className="text-xs text-gray-600 flex-1">{item.description}</span>
                              {item.delivery_date && (
                                <span className="text-xs text-gray-400">
                                  {new Date(item.delivery_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {contract.start_date && contract.end_date && (
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(contract.start_date).toLocaleDateString()} → {new Date(contract.end_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
