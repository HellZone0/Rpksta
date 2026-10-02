# QA Audit — Feature Pack 10

Basis: Feature Pack 09, preserving Bab 1–30 and the existing learning UI/features.

## Added
- Spaced repetition / Review Terjadwal with per-word due dates.
- Daily Challenge: deterministic 10-question daily pool and one-time +50 XP completion bonus per local day.
- Listening controls: speech rate 0.70x/0.85x/1.00x/1.15x and slash pause 500/650/800/1000 ms.
- Listening session counter and 7-day activity panel.
- Chapter mastery percentage in Statistics, alongside accuracy.

## Regression checks
- `node --check script.js` passed.
- `chapters.json` = 30 chapters.
- `vocabulary.json` = 2,355 entries.
- All vocabulary entries have id, bab 1–30, Korean text, and Indonesian meaning.
- Existing Feature Pack 09 listening slash-pause behavior retained.
- Existing correct/wrong quiz feedback and exam timer behavior retained.
