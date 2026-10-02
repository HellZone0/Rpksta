# QA Audit — Feature Pack 11

## Fix
- Fixed the blank blue button shown in the "Jawaban Benar!" popup.
- The correct-answer popup already marked `quizFeedbackAction` as hidden, but `.hidden` was only defined for modal overlays and the answer box. The button therefore remained visible without text.
- Added `.feedback-action.hidden{display:none!important}` so the button is completely removed from layout when hidden.
- Wrong-answer popup behavior is unchanged and still uses the action button.
- Cache-busting version updated to `20261002-feature-pack-11`.
