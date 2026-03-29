export default function DashboardLoading() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-2" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg bg-gray-100 animate-pulse" />
              <div className="ml-4 flex-1">
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Next event banner skeleton */}
      <div className="bg-indigo-600 rounded-lg p-6 mb-8 h-32 animate-pulse" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent activity skeleton */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                  <div className="ml-3">
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mb-1" />
                    <div className="h-2 w-32 bg-gray-50 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions skeleton */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="h-5 w-28 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-4 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center h-24">
                <div className="w-8 h-8 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
