"use client"

import { useEffect, useState } from "react"

interface Payout {
  id: string
  amount_cents: number
  currency: string
  status: "pending" | "processing" | "paid" | "failed"
  scheduled_at: string
  processed_at?: string
  stripe_transfer_id?: string
  tournament?: {
    name: string
  }
}

interface StripeStatus {
  connected: boolean
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [selectedTournament, setSelectedTournament] = useState("")
  const [amount, setAmount] = useState("")
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([])
  const [availableBalance, setAvailableBalance] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [payoutsRes, stripeRes] = await Promise.all([
        fetch("/api/operator/payouts"),
        fetch("/api/operator/stripe/account-status"),
      ])

      if (payoutsRes.ok) {
        const { data, availableBalanceCents } = await payoutsRes.json()
        setPayouts(data || [])
        setAvailableBalance(availableBalanceCents || 0)
      }

      if (stripeRes.ok) {
        const data = await stripeRes.json()
        setStripeStatus(data)
      }
    } catch (err) {
      console.error("Failed to fetch data:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setRequesting(true)

    try {
      const res = await fetch("/api/operator/payouts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: selectedTournament || undefined,
          amountCents: Math.round(parseFloat(amount) * 100),
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to request payout")

      setSuccess("Payout request submitted successfully!")
      setSelectedTournament("")
      setAmount("")
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setRequesting(false)
    }
  }

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const statusColor = (status: Payout["status"]) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-700"
      case "processing": return "bg-indigo-100 text-indigo-700"
      case "pending": return "bg-amber-100 text-amber-700"
      case "failed": return "bg-red-100 text-red-700"
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading payouts...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="text-gray-500 mt-1">
          Request payouts from your tournament registration revenue.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Not Connected Banner */}
      {!stripeStatus?.connected && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            Connect your Stripe account in{" "}
            <a href="/settings/stripe" className="font-semibold underline">
              Settings &rarr; Stripe
            </a>{" "}
            to request payouts.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Summary Card */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payout History</h2>
          {payouts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No payouts yet</p>
              <p className="text-sm">Request a payout once you have registration revenue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Tournament</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="py-3 text-gray-700">{formatDate(payout.scheduled_at)}</td>
                      <td className="py-3 text-gray-700">{payout.tournament?.name ?? "—"}</td>
                      <td className="py-3 font-medium text-gray-900">{formatCents(payout.amount_cents)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(payout.status)}`}>
                          {payout.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Request Payout Card */}
        {stripeStatus?.connected && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Payout</h2>
            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={availableBalance > 0 ? (availableBalance / 100).toFixed(2) : undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Available to withdraw: {formatCents(availableBalance)}
                </p>
              </div>
              <button
                type="submit"
                disabled={requesting}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {requesting ? "Processing..." : "Request Payout"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
