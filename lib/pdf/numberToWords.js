const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigits(n) {
  let out = "";
  if (n >= 100) { out += `${ONES[Math.floor(n / 100)]} Hundred`; n %= 100; if (n) out += " "; }
  if (n >= 20) { out += TENS[Math.floor(n / 10)]; if (n % 10) out += `-${ONES[n % 10]}`; }
  else if (n > 0) { out += ONES[n]; }
  return out;
}

// South Asian (lakh/crore) grouping, matching how amounts are normally read
// out loud in PKR — the same currency this app's amount-in-words is for.
const SCALES = [
  [10000000, "Crore"],
  [100000, "Lakh"],
  [1000, "Thousand"],
];

export function numberToWords(value) {
  let n = Math.round(Math.abs(Number(value) || 0));
  if (n === 0) return "Zero";
  const parts = [];
  for (const [scale, label] of SCALES) {
    if (n >= scale) {
      parts.push(`${threeDigits(Math.floor(n / scale))} ${label}`);
      n %= scale;
    }
  }
  if (n > 0) parts.push(threeDigits(n));
  return parts.join(" ");
}

export function amountInWords(value, currency = "PKR") {
  return `${currency} ${numberToWords(value)} Only`;
}
