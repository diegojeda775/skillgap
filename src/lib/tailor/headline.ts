/** "IT Support Technician II (Remote) - Hybrid" → "IT Support Technician II". */
export function headlineTitle(title: string) {
  return (
    title
      .replace(/\s*[([][^)\]]*[)\]]/g, "")
      .replace(/\s+[-–—|,/]\s*(?:remote|hybrid|on-?site|in-?office|contract|full[- ]time|part[- ]time)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim() || title.trim()
  );
}
