"use client"

import { useEffect, useState } from "react"

interface StripeStatus {
  connected: boolean
  stripeAccountId?: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirements?: {
    currentlyDue: string[]
    eventuallyDue: string[]
  }
}

export default function StripeSettingsPage() {
  const [status, setStatus] = useState<StripeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/operator/stripe/account-status")
      if (!res.ok) throw new Error("Failed to fetch status")
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch("/api/operator/stripe/create-onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create link")
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading Stripe status...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Stripe Connect</h1>
        <p className="text-gray-500 mt-1">
          Connect your Stripe account to receive payouts from tournament registrations.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {status?.connected ? (
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Stripe Account Connected</h2>
                  <p className="text-sm text-gray-500 font-mono">{status.stripeAccountId}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                Active
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatusBadge
                label="Charges Enabled"
                enabled={status.chargesEnabled}
              />
              <StatusBadge
                label="Payouts Enabled"
                enabled={status.payoutsEnabled}
              />
              <StatusBadge
                label="Details Submitted"
                enabled={status.detailsSubmitted}
              />
            </div>
          </div>

          {/* Requirements */}
          {status.requirements?.currentlyDue && status.requirements.currentlyDue.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-amber-900 mb-3">Action Required</h3>
              <p className="text-sm text-amber-700 mb-4">
                Complete the following to fully activate your Stripe account:
              </p>
              <ul className="space-y-2">
                {status.requirements.currentlyDue.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                    <span className="mt-1 text-amber-500">•</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Re-auth link */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Account</h3>
            <p className="text-sm text-gray-500 mb-4">
              Update your banking information, tax details, or review your Stripe dashboard.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {connecting ? "Loading..." : "Open Stripe Dashboard"}
            </button>
          </div>
        </div>
      ) : (
        /* Not Connected */
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Stripe Account</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Link a Standard Stripe account to receive payouts directly from tournament registration fees. Spotter retains a 10% platform fee.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-8 text-left max-w-sm mx-auto">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">What you need:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                A Stripe account (free to create)
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Business or personal bank account
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Basic identity verification
              </li>
            </ul>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {connecting ? "Preparing..." : "Connect with Stripe"}
          </button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className={`text-lg font-bold ${enabled ? "text-green-600" : "text-red-500"}`}>
        {enabled ? (
          <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
    </div>
  )
}
