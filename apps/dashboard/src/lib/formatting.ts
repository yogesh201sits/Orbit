export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);

    if (diffSec < 0) {
      // Future
      const absSec = Math.abs(diffSec);
      if (absSec < 60) return `in ${absSec}s`;
      if (absSec < 3600) return `in ${Math.floor(absSec / 60)}m`;
      if (absSec < 86400) return `in ${Math.floor(absSec / 3600)}h`;
      return `in ${Math.floor(absSec / 86400)}d`;
    }

    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return "—";
  }
}

export function formatDuration(durationMs?: number | null, start?: string | null, end?: string | null): string {
  let ms = durationMs;
  if ((ms === undefined || ms === null) && start) {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    if (!isNaN(s) && !isNaN(e)) {
      ms = Math.max(0, e - s);
    }
  }

  if (ms === undefined || ms === null || isNaN(ms)) return "—";

  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(2)}s`;
  const min = Math.floor(sec / 60);
  const remainingSec = Math.floor(sec % 60);
  if (min < 60) return `${min}m ${remainingSec}s`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ${min % 60}m`;
}

export function truncateId(id: string, start = 8, end = 4): string {
  if (!id || id.length <= start + end) return id;
  return `${id.slice(0, start)}...${id.slice(-end)}`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}
