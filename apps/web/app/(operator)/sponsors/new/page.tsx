"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TIERS = [
  { value: 'bronze', label: 'Bronze', description: 'Basic sponsorship' },
  { value: 'silver', label: 'Silver', description: 'Enhanced visibility' },
  { value: 'gold', label: 'Gold', description: 'Premium placement + logo on course' },
  { value: 'custom', label: 'Custom', description: 'Tailored package' },
]

export default function NewSponsorPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    tier: 'bronze',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const supabase = createClient()

        // First get the current user and their organizer_id
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Not authenticated')
          return
        }

        const { data: member } = await supabase
          .from('organizer_members')
          .select('organizer_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()

        if (!member) {
          setError('No organizer account found')
          return
        }

        const { error: insertError } = await supabase
          .from('sponsors')
          .insert({
            organizer_id: member.organizer_id,
            name: form.name,
            contact_name: form.contactName || null,
            contact_email: form.contactEmail,
            contact_phone: form.contactPhone || null,
            website_url: form.websiteUrl || null,
            tier: form.tier,
            notes: form.notes || null,
          })

        if (insertError) {
          setError(insertError.message)
          return
        }

        router.push('/sponsors')
        router.refresh()
      } catch (err) {
        setError('An unexpected error occurred')
      }
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <Link href="/sponsors" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
          ← Back to Sponsors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add New Sponsor</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Sponsor Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sponsor Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Acme Golf Co."
          />
        </div>

        {/* Tier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sponsorship Tier <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {TIERS.map(tier => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, tier: tier.value }))}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  form.tier === tier.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{tier.label}</p>
                <p className="text-xs text-gray-500">{tier.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={form.contactEmail}
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="jane@acmegolf.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input
                type="url"
                value={form.websiteUrl}
                onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://acmegolf.com"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Internal notes about this sponsor..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/sponsors"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Add Sponsor'}
          </button>
        </div>
      </form>
    </div>
  )
}
