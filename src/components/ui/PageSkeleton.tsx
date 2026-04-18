export default function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-7 bg-surface-high rounded w-48" />
      <div className="h-4 bg-surface-high rounded w-72" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-surface-high rounded-lg" />
        ))}
      </div>
    </div>
  )
}
