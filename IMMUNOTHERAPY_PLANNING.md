# Immunotherapy Module — Planning Document
**Status:** Brainstorming / Pre-build  
**Date initiated:** 2026-04-09  
**Key stakeholders:** Mark Putiyon, BJ Hockney (bjhockney@vcfaa.com), Dr. Rob Sikora

---

## Background

The practice uses a standard 5-vial dilution system for allergen immunotherapy (SCIT).  
Reference form: `3c-Immunotherapy-Administration-Form-for-One-Vial.docx`

---

## Vial Color System (AAAAI Standard)

| Color | Dilution | Vial # | Strength |
|---|---|---|---|
| 🩶 Silver | 1:10,000 (v/v) | Vial 5 | Weakest |
| 💚 Green | 1:1,000 (v/v) | Vial 4 | |
| 💙 Blue | 1:100 (v/v) | Vial 3 | |
| 💛 Yellow | 1:10 (v/v) | Vial 2 | |
| ❤️ Red | 1:1 (v/v) | Vial 1 | Strongest / Maintenance |

---

## What Each Shot Administration Records (from form)

- Date / Time
- Health screen (Y/N): asthma symptoms, beta-blocker use, pregnancy, prior reaction
- Peak Flow (Best Baseline + current reading)
- Injector initials
- Arm (R/L)
- Vial number + Dilution/Color
- Delivered volume (ml)
- Reaction:
  - Local Reaction (LR) — reported in mm (wheal + erythema)
  - Systemic Reaction (SR) — documented separately in medical record

---

## Standard Build-Up Dose Progression

Each vial progresses through doses before advancing to the next:
`0.05 → 0.10 → 0.15 → 0.20 → 0.25 → 0.30 → 0.35 → 0.40 → 0.45 → 0.50 ml`

Patient works through Silver → Green → Blue → Yellow → Red over weeks/months.

---

## Vial Build — What Needs to Be Tracked

| Field | Notes |
|---|---|
| Patient | Linked to patient record |
| Vial set # | Set 1 (initial), Set 2 (renewal), etc. |
| Vial color / dilution | Silver, Green, Blue, Yellow, Red |
| Mix date | Date vial was compounded |
| Expiration date | Typically 6 months from mix |
| Allergens included | e.g. Bermuda, Timothy, D. farinae |
| Volume per allergen (ml) | Per constituent stock allergen |
| Total volume (ml) | e.g. 10ml |
| Lot # per stock allergen | For USP 797 traceability |
| Prepared by | Nurse/tech initials |
| Physician order | Prescribing physician |
| Date to reorder | Tracked per vial set |

---

## Planned Data Model

```
AllergenInventory
  id, name, manufacturer, lotNumber, stockConc, volumeRemaining
  expiresAt, receivedAt, storedTemp, active

PatientVialSetFormula (physician prescription)
  id, patientId, physicianId, prescribedAt
  allergens: [{ allergenId, volumeMl }]
  notes

PatientVialSet (one per color/dilution per patient)
  id, patientId, formulaId, vialColor, dilution, vialNumber
  mixDate, expiresAt, totalVolumeMl, remainingVolumeMl
  builtBy (staffId), locationId, status (active/expired/depleted)
  constituents: [{ inventoryId, volumeMl, lotNumber }]

ImmunotherapySchedule (projected dose plan)
  id, patientId, vialSetId
  doses: [{ stepNumber, vialColor, volumeMl, status, scheduledDate }]

ImmunotherapyAdministration (each shot given)
  id, patientId, vialSetId, scheduleStepId
  administeredAt, administeredBy (staffId)
  arm (R/L), volumeDelivered (ml)
  healthScreen (boolean), peakFlow, peakFlowBaseline
  reactionType (none/LR/SR), reactionMm, reactionNotes
  encounterId (linked to encounter record)
```

---

## Open Questions for BJ Hockney

> **BJ to answer these before we build:**

1. **How many vials per patient set?**  
   - Is it 1 vial with 5 dilutions built from it, or 5 separate mixed vials (one per color)?

2. **Who builds the vials?**  
   - Nurse, tech, or physician? (affects permission/role requirements)

3. **Is the formula prescribed fresh each time or carried forward?**  
   - Does Dr. Sikora write a new Rx for each vial set, or is the original formula reused for renewals?

4. **How are constituent allergens tracked?**  
   - By lot number only? Stock vial expiration? Both?

5. **USP 797 compliance required?**  
   - Do we need: beyond-use dating, temperature logging, prep environment documentation?

6. **Separate prescription/formula record or ad-hoc?**  
   - Is there a formal formula document the nurse references when building, or is it in the chart?

7. **How do patients advance through vial sets?**  
   - When Red vial runs out → replace just Red, or restart full Silver→Red set?
   - What triggers a new full set? (yearly, formula change, compliance gap)

8. **Dose adjustment rules — are these clinic-defined or standard?**  
   - LR > 25mm → hold or reduce?
   - Missed > 2 weeks → step back how many doses?
   - SR → physician must sign off before next shot?

9. **Multi-vial patients?**  
   - Do any patients get separate vials for different allergen groups (e.g. tree mix + grass mix) given at same visit?

10. **Billing integration priority?**  
    - Auto-calculate CPT 95165 units from vial contents?
    - Auto-suggest 95115 vs 95117 based on injections given?

---

## Module Scope (when ready to build)

### Phase 1 — Core Administration
- Patient vial set management (create, track, expire)
- Shot administration form (digital version of Form 3c)
- Build-up schedule generator
- Reaction logging

### Phase 2 — Vial Build / Compounding
- Allergen inventory (stock vials)
- Vial build workflow (formula → mix → label)
- USP 797 compliance fields
- Date-to-reorder alerts

### Phase 3 — Billing & Reporting
- CPT 95115/95117 auto-suggestion
- CPT 95165 unit calculation
- Patient adherence reports
- Vial expiration alerts
- Dose progress dashboard

### Phase 4 — Physician Tools
- Formula prescription interface
- Dose adjustment workflow
- SR review/sign-off
- Patient immunotherapy summary

---

## Related Files
- `3c-Immunotherapy-Administration-Form-for-One-Vial.docx` — administration form
- `1c-Allergy-Skin-Test-Report-Form-Complete-Example.docx` — skin test form (allergens)
- `BUSINESS_RULES.md` — billing rules for allergy CPT codes
- `prisma/schema.prisma` — current DB schema (Vial, DosingSchedule models partially exist)

---

*Last updated: 2026-04-09*
