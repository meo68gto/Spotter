'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import { FormEvent, useEffect, useMemo, useState } from 'react'

type CoachConsoleRow = {
  engagementRequestId: string
  reviewOrderId: string | null
  status: string
  serviceTitle: string
  serviceType: string
  buyerName: string
  buyerUserId: string | null
  questionText: string
  amountCents: number
  currency: string
  paidAt: string | null
  acceptedDeadlineAt: string | null
  deliveryDeadlineAt: string | null
  createdAt: string
  assetCount: number
}

type CoachRequestDetail = {
  id: string
  status: string
  question_text: string
  buyer_note?: string | null
  request_details?: Record<string, unknown> | null
  scheduled_time?: string | null
  accepted_deadline_at?: string | null
  delivery_deadline_at?: string | null
  delivered_at?: string | null
  coach_service?: {
    id: string
    title: string
    service_type: string
    price_cents: number
    currency: string
    turnaround_hours?: number | null
    requires_video?: boolean | null
  } | null
  requester?: {
    id: string
    display_name?: string | null
    avatar_url?: string | null
    bio?: string | null
  } | null
  review_order?: {
    id: string
    status: string
    amount_cents: number
    currency: string
    payout_status?: string | null
    refund_reason?: string | null
    paid_at?: string | null
    refunded_at?: string | null
  } | null
  engagement_assets?: Array<{
    id: string
    asset_type?: string | null
    role?: string | null
    storage_path?: string | null
  }>
  engagement_responses?: Array<{
    id: string
    summary_text?: string | null
    response_text?: string | null
    structured_feedback?: Record<string, unknown> | null
  }>
  engagement_status_events?: Array<{
    id: string
    event_type: string
    from_status?: string | null
    to_status?: string | null
    created_at: string
  }>
}

type CoachService = {
  id: string
  coach_id: string
  service_type: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  turnaround_hours: number | null
  duration_minutes: number | null
  requires_video: boolean
  requires_schedule: boolean
  active: boolean
  sort_order: number
}

type ReviewOrderRow = {
  id: string
  status: string
  payout_status: string | null
  amount_cents: number
  coach_payout_cents: number | null
  currency: string
  refunded_at: string | null
  created_at: string
}

type ServiceDraft = {
  title: string
  serviceType: string
  description: string
  price: string
  turnaroundHours: string
  durationMinutes: string
  requiresVideo: boolean
  requiresSchedule: boolean
}

const EMPTY_SERVICE_DRAFT: ServiceDraft = {
  title: '',
  serviceType: 'video_review',
  description: '',
  price: '79',
  turnaroundHours: '48',
  durationMinutes: '45',
  requiresVideo: true,
  requiresSchedule: false
}

const statusBuckets: Array<{ key: string; label: string; match: (row: CoachConsoleRow) => boolean }> = [
  { key: 'needs_acceptance', label: 'Needs Acceptance', match: (row) => ['paid', 'queued'].includes(row.status) },
  { key: 'due_soon', label: 'Due Soon', match: (row) => ['accepted', 'in_review', 'scheduled'].includes(row.status) },
  { key: 'in_review', label: 'In Review', match: (row) => row.status === 'in_review' },
  { key: 'scheduled', label: 'Scheduled Calls', match: (row) => ['scheduled', 'in_call'].includes(row.status) },
  { key: 'delivered', label: 'Delivered', match: (row) => row.status === 'delivered' },
  { key: 'refund_problem', label: 'Refund / Problem', match: (row) => ['refund_pending', 'refunded', 'declined', 'expired'].includes(row.status) }
]

const currency = (amountCents: number, code = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: code.toUpperCase() }).format((amountCents ?? 0) / 100)

export default function CoachingPage() {
  const supabase = createBrowserClient()
  const [coachId, setCoachId] = useState<string | null>(null)
  const [coachName, setCoachName] = useState('Coach Console')
  const [loading, setLoading] = useState(true)
  const [savingService, setSavingService] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [consoleRows, setConsoleRows] = useState<CoachConsoleRow[]>([])
  const [requestDetail, setRequestDetail] = useState<CoachRequestDetail | null>(null)
  const [services, setServices] = useState<CoachService[]>([])
  const [orders, setOrders] = useState<ReviewOrderRow[]>([])
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(EMPTY_SERVICE_DRAFT)
  const [reviewSummary, setReviewSummary] = useState('')
  const [reviewBody, setReviewBody] = useState('')
  const [reviewJson, setReviewJson] = useState('{\n  "priorities": [],\n  "drills": []\n}')

  const groupedRows = useMemo(
    () =>
      statusBuckets.map((bucket) => ({
        ...bucket,
        rows: consoleRows.filter(bucket.match)
      })),
    [consoleRows]
  )

  const payoutSummary = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.payout_status === 'eligible') acc.eligible += order.coach_payout_cents ?? 0
        else if (order.payout_status === 'reversed') acc.reversed += order.coach_payout_cents ?? 0
        else acc.held += order.coach_payout_cents ?? 0
        return acc
      },
      { held: 0, eligible: 0, reversed: 0 }
    )
  }, [orders])

  const loadConsole = async (preserveSelection = true) => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Sign in to access the coach console.')
        return
      }

      const [{ data: coach }, { data: profile }] = await Promise.all([
        supabase.from('coaches').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      ])

      setCoachName(profile?.display_name || 'Coach Console')
      setCoachId(coach?.id ?? null)
      if (!coach?.id) {
        setError('You do not have an active coach profile yet.')
        setConsoleRows([])
        setServices([])
        setOrders([])
        return
      }

      const [{ data: inboxResp, error: inboxError }, { data: servicesData }, { data: payoutRows }] = await Promise.all([
        supabase.functions.invoke('coach-console-list'),
        supabase
          .from('coach_services')
          .select('id, coach_id, service_type, title, description, price_cents, currency, turnaround_hours, duration_minutes, requires_video, requires_schedule, active, sort_order')
          .eq('coach_id', coach.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('review_orders')
          .select('id, status, payout_status, amount_cents, coach_payout_cents, currency, refunded_at, created_at')
          .eq('coach_id', coach.id)
          .order('created_at', { ascending: false })
          .limit(50)
      ])

      if (inboxError) throw inboxError

      const inboxRows = (inboxResp?.data ?? inboxResp ?? []) as CoachConsoleRow[]
      setConsoleRows(inboxRows)
      setServices((servicesData ?? []) as CoachService[])
      setOrders((payoutRows ?? []) as ReviewOrderRow[])

      const nextSelectedId =
        preserveSelection && selectedRequestId && inboxRows.some((row) => row.engagementRequestId === selectedRequestId)
          ? selectedRequestId
          : inboxRows[0]?.engagementRequestId ?? null
      setSelectedRequestId(nextSelectedId)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load coach console')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (engagementRequestId: string) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('coach-request-detail', {
        body: { engagementRequestId }
      })
      if (invokeError) throw invokeError
      setRequestDetail((data?.data ?? data) as CoachRequestDetail)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Unable to load request detail')
    }
  }

  useEffect(() => {
    loadConsole(false)
  }, [])

  useEffect(() => {
    if (selectedRequestId) {
      loadDetail(selectedRequestId)
    } else {
      setRequestDetail(null)
    }
  }, [selectedRequestId])

  const runTransition = async (action: 'accept' | 'decline' | 'start_review' | 'mark_scheduled' | 'mark_in_call') => {
    if (!requestDetail) return
    setTransitioning(action)
    setError(null)
    try {
      const { error: invokeError } = await supabase.functions.invoke('coach-request-transition', {
        body: { engagementRequestId: requestDetail.id, action }
      })
      if (invokeError) throw invokeError
      await loadConsole()
      await loadDetail(requestDetail.id)
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'Unable to update request')
    } finally {
      setTransitioning(null)
    }
  }

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requestDetail) return
    setSubmittingReview(true)
    setError(null)
    try {
      const structuredFeedback = reviewJson.trim() ? JSON.parse(reviewJson) : {}
      const { error: invokeError } = await supabase.functions.invoke('coach-review-submit', {
        body: {
          engagementRequestId: requestDetail.id,
          summaryText: reviewSummary.trim(),
          responseText: reviewBody.trim(),
          structuredFeedback
        }
      })
      if (invokeError) throw invokeError
      setReviewSummary('')
      setReviewBody('')
      await loadConsole()
      await loadDetail(requestDetail.id)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit feedback')
    } finally {
      setSubmittingReview(false)
    }
  }

  const saveService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!coachId) return
    setSavingService(true)
    setError(null)
    try {
      const sortOrder = services.length + 1
      const payload = {
        coach_id: coachId,
        service_type: serviceDraft.serviceType,
        title: serviceDraft.title.trim(),
        description: serviceDraft.description.trim() || null,
        price_cents: Math.round(Number(serviceDraft.price) * 100),
        currency: 'usd',
        turnaround_hours: serviceDraft.turnaroundHours ? Number(serviceDraft.turnaroundHours) : null,
        duration_minutes: serviceDraft.durationMinutes ? Number(serviceDraft.durationMinutes) : null,
        requires_video: serviceDraft.requiresVideo,
        requires_schedule: serviceDraft.requiresSchedule,
        active: true,
        sort_order: sortOrder
      }

      const { error: upsertError } = await supabase.from('coach_services').insert(payload)
      if (upsertError) throw upsertError
      setServiceDraft(EMPTY_SERVICE_DRAFT)
      await loadConsole()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save service')
    } finally {
      setSavingService(false)
    }
  }

  const toggleService = async (serviceId: string, active: boolean) => {
    setError(null)
    try {
      const { error: updateError } = await supabase.from('coach_services').update({ active: !active }).eq('id', serviceId)
      if (updateError) throw updateError
      await loadConsole()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update service')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{coachName}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Unified coach commerce inbox, review workspace, services, and payouts.
          </p>
        </div>
        <button
          onClick={() => loadConsole()}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Inbox" value={String(consoleRows.length)} hint="Open requests across all coach workflows" />
        <MetricCard label="Held earnings" value={currency(payoutSummary.held)} hint="Paid orders waiting on delivery or settlement" />
        <MetricCard label="Payout eligible" value={currency(payoutSummary.eligible)} hint="Delivered orders ready for payout release" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Coach Inbox</h2>
              <p className="text-sm text-slate-400">Requests grouped by coach action and SLA stage.</p>
            </div>
            {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
          </div>

          <div className="space-y-5">
            {groupedRows.map((bucket) => (
              <div key={bucket.key}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">{bucket.label}</h3>
                  <span className="text-xs text-slate-500">{bucket.rows.length}</span>
                </div>
                <div className="space-y-2">
                  {bucket.rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                      No requests in this lane.
                    </div>
                  ) : (
                    bucket.rows.map((row) => (
                      <button
                        key={row.engagementRequestId}
                        onClick={() => setSelectedRequestId(row.engagementRequestId)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selectedRequestId === row.engagementRequestId
                            ? 'border-cyan-400/50 bg-cyan-500/10'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">{row.buyerName}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{row.serviceTitle}</p>
                          </div>
                          <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase text-slate-300">
                            {row.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm text-slate-300">{row.questionText}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>{currency(row.amountCents, row.currency)}</span>
                          <span>{row.assetCount} assets</span>
                          <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Request Detail</h2>
                <p className="text-sm text-slate-400">Buyer context, payment state, assets, and delivery controls.</p>
              </div>
              {requestDetail ? (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {requestDetail.status.replace(/_/g, ' ')}
                </span>
              ) : null}
            </div>

            {!requestDetail ? (
              <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-10 text-sm text-slate-500">
                Select a request from the inbox to open the coach workspace.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailCard label="Buyer" value={requestDetail.requester?.display_name ?? 'Buyer'} />
                  <DetailCard label="Service" value={requestDetail.coach_service?.title ?? 'Coach Service'} />
                  <DetailCard label="Payment" value={requestDetail.review_order?.status ?? 'unpaid'} />
                  <DetailCard label="Payout" value={requestDetail.review_order?.payout_status ?? 'pending'} />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Question</p>
                  <p className="mt-2 text-sm text-slate-200">{requestDetail.question_text}</p>
                  {requestDetail.buyer_note ? <p className="mt-3 text-sm text-slate-400">Buyer note: {requestDetail.buyer_note}</p> : null}
                  {requestDetail.request_details ? (
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-300">
                      {JSON.stringify(requestDetail.request_details, null, 2)}
                    </pre>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <DetailCard
                    label="Accept by"
                    value={requestDetail.accepted_deadline_at ? new Date(requestDetail.accepted_deadline_at).toLocaleString() : 'Not set'}
                  />
                  <DetailCard
                    label="Deliver by"
                    value={requestDetail.delivery_deadline_at ? new Date(requestDetail.delivery_deadline_at).toLocaleString() : 'Not set'}
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Assets</p>
                  <div className="mt-3 space-y-2">
                    {(requestDetail.engagement_assets ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No uploaded assets yet.</p>
                    ) : (
                      requestDetail.engagement_assets?.map((asset) => (
                        <div key={asset.id} className="rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-300">
                          {(asset.role ?? asset.asset_type ?? 'asset').replace(/_/g, ' ')}: {asset.storage_path ?? asset.id}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton disabled={!!transitioning} label="Accept" onClick={() => runTransition('accept')} />
                  <ActionButton disabled={!!transitioning} label="Start Review" onClick={() => runTransition('start_review')} />
                  <ActionButton disabled={!!transitioning} label="Mark Scheduled" onClick={() => runTransition('mark_scheduled')} />
                  <ActionButton disabled={!!transitioning} label="Mark In Call" onClick={() => runTransition('mark_in_call')} />
                  <ActionButton disabled={!!transitioning} destructive label="Decline + Refund" onClick={() => runTransition('decline')} />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Timeline</p>
                  <div className="mt-3 space-y-3">
                    {(requestDetail.engagement_status_events ?? []).map((event) => (
                      <div key={event.id} className="border-l border-slate-700 pl-3">
                        <p className="text-sm font-medium text-slate-200">{event.event_type}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(event.created_at).toLocaleString()}
                          {event.to_status ? ` • ${event.to_status.replace(/_/g, ' ')}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={submitReview} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">Review Workspace</h3>
                    <p className="text-sm text-slate-400">Deliver the canonical feedback package for this request.</p>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm text-slate-300">
                      Summary
                      <input
                        value={reviewSummary}
                        onChange={(event) => setReviewSummary(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                        placeholder="Three sentence summary of the review"
                      />
                    </label>
                    <label className="block text-sm text-slate-300">
                      Feedback body
                      <textarea
                        value={reviewBody}
                        onChange={(event) => setReviewBody(event.target.value)}
                        className="mt-1 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                        placeholder="Timestamped notes, drills, and next steps"
                      />
                    </label>
                    <label className="block text-sm text-slate-300">
                      Structured feedback JSON
                      <textarea
                        value={reviewJson}
                        onChange={(event) => setReviewJson(event.target.value)}
                        className="mt-1 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingReview ? 'Submitting…' : 'Deliver Feedback'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white">Coach Services</h2>
                <p className="text-sm text-slate-400">Create, price, and activate your sellable services.</p>
              </div>
              <form onSubmit={saveService} className="space-y-3">
                <input
                  value={serviceDraft.title}
                  onChange={(event) => setServiceDraft((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  placeholder="Video Review"
                />
                <select
                  value={serviceDraft.serviceType}
                  onChange={(event) =>
                    setServiceDraft((current) => ({
                      ...current,
                      serviceType: event.target.value,
                      requiresVideo: event.target.value === 'video_review',
                      requiresSchedule: event.target.value === 'live_video_call'
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                >
                  <option value="video_review">Video Review</option>
                  <option value="live_video_call">Live Video Call</option>
                  <option value="swing_plan">Swing Plan</option>
                  <option value="text_qna">Text Q&amp;A</option>
                </select>
                <textarea
                  value={serviceDraft.description}
                  onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                  placeholder="What the buyer gets, turnaround promise, and ideal use case"
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    value={serviceDraft.price}
                    onChange={(event) => setServiceDraft((current) => ({ ...current, price: event.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    placeholder="79"
                  />
                  <input
                    value={serviceDraft.turnaroundHours}
                    onChange={(event) => setServiceDraft((current) => ({ ...current, turnaroundHours: event.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    placeholder="48"
                  />
                  <input
                    value={serviceDraft.durationMinutes}
                    onChange={(event) => setServiceDraft((current) => ({ ...current, durationMinutes: event.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
                    placeholder="45"
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={serviceDraft.requiresVideo}
                      onChange={(event) => setServiceDraft((current) => ({ ...current, requiresVideo: event.target.checked }))}
                    />
                    Requires video
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={serviceDraft.requiresSchedule}
                      onChange={(event) => setServiceDraft((current) => ({ ...current, requiresSchedule: event.target.checked }))}
                    />
                    Requires schedule
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={savingService || !serviceDraft.title.trim()}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingService ? 'Saving…' : 'Add Service'}
                </button>
              </form>

              <div className="mt-5 space-y-3">
                {services.map((serviceRow) => (
                  <div key={serviceRow.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{serviceRow.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{serviceRow.service_type.replace(/_/g, ' ')}</p>
                      </div>
                      <button
                        onClick={() => toggleService(serviceRow.id, serviceRow.active)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          serviceRow.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {serviceRow.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{serviceRow.description || 'No description yet.'}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{currency(serviceRow.price_cents, serviceRow.currency)}</span>
                      <span>{serviceRow.turnaround_hours ?? 'n/a'}h turnaround</span>
                      <span>{serviceRow.duration_minutes ?? 'n/a'} min</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white">Payouts</h2>
                <p className="text-sm text-slate-400">Held, eligible, and reversed earnings across coach orders.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="Held" value={currency(payoutSummary.held)} hint="Waiting on delivery" compact />
                <MetricCard label="Eligible" value={currency(payoutSummary.eligible)} hint="Ready to release" compact />
                <MetricCard label="Reversed" value={currency(payoutSummary.reversed)} hint="Refunded or reversed" compact />
              </div>
              <div className="mt-4 space-y-3">
                {orders.slice(0, 8).map((order) => (
                  <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{currency(order.amount_cents, order.currency)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {order.status} • {order.payout_status ?? 'pending'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">Coach payout: {currency(order.coach_payout_cents ?? 0, order.currency)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
  compact = false
}: {
  label: string
  value: string
  hint: string
  compact?: boolean
}) {
  return (
    <div className={`rounded-3xl border border-slate-800 bg-slate-950/70 ${compact ? 'p-4' : 'p-5'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-2 font-semibold text-white ${compact ? 'text-xl' : 'text-3xl'}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{hint}</p>
    </div>
  )
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-200">{value}</p>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
  destructive = false
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        destructive
          ? 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
          : 'bg-slate-800 text-white hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}
