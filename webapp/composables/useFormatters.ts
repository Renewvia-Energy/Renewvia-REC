export function useFormatters() {
  function formatDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function viewUrl(url: string): string {
    return `/api/uploads/view?url=${encodeURIComponent(url)}`
  }

  return { formatDate, viewUrl }
}
