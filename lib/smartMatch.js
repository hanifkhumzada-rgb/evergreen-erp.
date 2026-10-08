export function normalizeSmartText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/ck|q/g, "k")
    .replace(/z/g, "s")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function smartScore(option, query, keys = ["label", "name", "code", "mobile"]) {
  const q = normalizeSmartText(query);
  if (!q) return 1;
  const values = keys.map((key) => normalizeSmartText(option?.[key])).filter(Boolean);
  if (values.some((value) => value === q)) return 100;
  if (values.some((value) => value.startsWith(q))) return 80;
  if (values.some((value) => value.split(" ").some((word) => word.startsWith(q)))) return 65;
  if (values.some((value) => value.includes(q))) return 50;
  const qParts = q.split(" ");
  if (qParts.every((part) => values.some((value) => value.includes(part)))) return 35;
  return 0;
}

export function rankSmartOptions(options, query, keys, limit = 12) {
  return options
    .map((option, index) => ({ option, index, score: smartScore(option, query, keys) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((row) => row.option);
}
