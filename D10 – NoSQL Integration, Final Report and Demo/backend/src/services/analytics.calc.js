// Track B bidding analytics: pure calculations in integer cents (and hundredths of a
// percent), so results are exact before the final rounding for display.
const toCents = v => Math.round(Number(v) * 100);
const fromCents = c => (c / 100).toFixed(2);

function averageRate(rates) {
  if (!rates.length) return null;
  const hundredths = rates.reduce((s, r) => s + toCents(r), 0);
  return (Math.round(hundredths / rates.length) / 100).toFixed(2);
}

// Upper bound inclusive; 0% is its own bucket (random draws and the last member are always 0%).
const BUCKETS = [
  {label: '0%', min: 0, max: 0},
  {label: '0–5%', min: 0, max: 5},
  {label: '5–10%', min: 5, max: 10},
  {label: '10–20%', min: 10, max: 20},
  {label: '20–50%', min: 20, max: 50}
];
const SELECTIONS = ['bid', 'random_draw', 'final_member'];

function distribution(winners) {
  return BUCKETS.map(b => {
    const inBucket = winners.filter(w => {
      const r = Number(w.winning_rate);
      return b.max === 0 ? r === 0 : r > b.min && r <= b.max;
    });
    const counts = Object.fromEntries(SELECTIONS.map(s => [s, inBucket.filter(w => w.selection === s).length]));
    return {label: b.label, total: inBucket.length, ...counts};
  });
}

// Cost of credit (formulas in the README): advance = n*C - D - k*C, repaid by m = n - k
// contributions; the per-cycle rate r solves advance = C * (1 - (1+r)^-m) / r (bisection).
// Not annualised: cycles have no fixed calendar length.
function perCycleRate(advance, instalment, m) {
  if (m < 1 || advance <= 0) return null;
  if (instalment * m <= advance) return 0;
  const pv = r => instalment * (1 - Math.pow(1 + r, -m)) / r;
  let lo = 1e-9, hi = 10;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (pv(mid) > advance) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

function costOfCredit({members, contribution, position, discount}) {
  const C = toCents(contribution), D = toCents(discount);
  const pot = members * C, received = pot - D, advance = received - position * C;
  const m = Math.max(0, members - position);
  const borrower = advance > 0 && m > 0;
  const r = borrower ? perCycleRate(advance, C, m) : null;
  return {
    pot_amount: fromCents(pot), discount_amount: fromCents(D), net_received: fromCents(received),
    contributions_paid_before: fromCents(position * C), advance: fromCents(Math.max(0, advance)),
    repayment_cycles: m, repayments_remaining: fromCents(m * C), borrower,
    total_cost_pct: borrower ? (Math.round((D / advance) * 10000) / 100).toFixed(2) : null,
    per_cycle_rate_pct: r === null ? null : (Math.round(r * 10000) / 100).toFixed(2)
  };
}

module.exports = {averageRate, distribution, costOfCredit, perCycleRate, SELECTIONS};
