// D10: user-facing cycle status. The stored values stay unchanged (no data migration);
// users only ever see three statuses:
//   open              -> 'open'     active; the bidding window is reported separately
//   closed            -> 'closed'   payout made, discount shares final   (outcome 'payout')
//   expired (stored)  -> 'closed'   ended without a winner, contributions carried forward
//                                  to the next cycle                    (outcome 'no_winner')
//   awaiting_decision -> 'expired'  deadline passed without bids; organizer action required
//   pending           -> null       not started yet: hidden from users
const DISPLAY = {open: 'open', closed: 'closed', expired: 'closed', awaiting_decision: 'expired', pending: null};
const OUTCOME = {closed: 'payout', expired: 'no_winner'};

const display = status => (status in DISPLAY ? DISPLAY[status] : null);
const outcome = status => OUTCOME[status] || null;
const withDisplay = cycle => ({...cycle, display_status: display(cycle.status), outcome: outcome(cycle.status)});

module.exports = {display, outcome, withDisplay};
