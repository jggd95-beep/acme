# MASTER COPY — Acme HVAC Quotes
**Label:** MASTER-2026-08-06-SOLID

## Critical fix in this build
- `DEFAULT_JOB_GOALS` was used on Situation / Measure types without being imported.
  That threw a ReferenceError when those steps rendered (around step 2–3). Fixed.

## Includes
- Sparse home, splash, Acme HVAC brand
- Backend nav + hub (Products, Measures, Questions/tentacles, Job goals, …)
- Job packages full-width select/switch/clear
- Wall heat Top-vent / Direct-vent / Counterflow + packet language
- Sticky wizard footer (Back/Next)
- Global price adjust + measure language editors
- No Heating path chips on Equipment

## Go live
```bash
bash ./go-live.sh
# or: npm install && npm run dev -- --host 0.0.0.0 --port 8080
```
PIN for Backend unlock: `owner`
