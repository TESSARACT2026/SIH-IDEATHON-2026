# Scoring Methodology

This document describes the deterministic scoring formulas used by MargDarshak.
Every number shown to users traces back to this code — the LLM never estimates or
invents a score.

---

## 1. Trip Health Score (Feature 2)

**Purpose:** A 0–100 composite score reflecting real-time risk factors for a trip.

**Formula:** `score = 100 - Σ(penalty_i)`

### Sub-Scores and Weights

| Category        | Max Penalty | Description                                      |
|-----------------|-------------|--------------------------------------------------|
| Weather         | 25          | Severe weather (>42°C, thunderstorm, storm)      |
| Crowd           | 25          | Average crowd level across itinerary stops       |
| Closures        | 20          | Active sensitivity flags / closures              |
| Data Quality    | 15          | Proportion of unverified/disputed/outdated facts |
| Accessibility   | 15          | Mismatches between user needs and attractions    |

### Weather Penalty Calculation
- Rain on a trip day: +3.75 penalty (15% of 25)
- Severe condition (>42°C, thunderstorm, snow): proportional to affected days
- `severe_penalty = (severe_day_count / total_trip_days) × 25`
- Total weather penalty capped at 25

### Crowd Penalty Calculation
- Each attraction's crowd level mapped to a risk score:
  - LOW = 0, MODERATE = 0.3, HIGH = 0.7, SEVERE = 1.0
- `crowd_penalty = average_risk × 25`

### Data Quality Penalty
- `data_penalty = (unverified_fact_count / total_fact_count) × 15`
- Unverified includes: UNVERIFIED, DISPUTED, OUTDATED statuses

### Score Labels
- 80–100: Excellent (🟢)
- 60–79: Good (🟡)
- 40–59: Fair (🟠)
- 0–39: At Risk (🔴)

**Source file:** `backend/src/modules/scoring/trip-health.ts`

---

## 2. Tourism Impact Score (Feature 4)

**Purpose:** Compare a "Popular route" against a "Responsible route" using real
data from two independently-generated itineraries.

### How Variants Are Generated
1. **Popular Route:** Standard planner output (default weights)
2. **Responsible Route:** Same planner re-run with:
   - `strictCrowdFilter: true` (exclude HIGH crowd, not just SEVERE)
   - `crowdAvoidanceWeight: 3.0` (strongly prefer LOW crowd attractions)
   - `localBusinessPreferenceWeight: 2.0` (boost local-business proximity)

### Comparison Metrics (all computed from real plan data)
- **Crowd Pressure Delta:** `popular.highCrowdStops - responsible.highCrowdStops`
- **Local Business Delta:** Count of itinerary stops within ~500m of verified local businesses
- **Note:** If a metric can't be computed from real data, it displays "not available"

**Source file:** `backend/src/modules/scoring/tourism-impact.ts`

---

## 3. Trip Trust Score (Feature 10)

**Purpose:** Aggregate per-fact verification status into a single trip-level
confidence score.

**Formula:** `trustScore = (weighted_sum / total_facts) × freshness_factor × 100`

### Verification Status Weights

| Status       | Weight |
|--------------|--------|
| VERIFIED     | 1.0    |
| LIVE         | 1.0    |
| COMMUNITY    | 0.7    |
| INFERRED     | 0.4    |
| UNVERIFIED   | 0.2    |
| NEEDS_REVIEW | 0.15   |
| OUTDATED     | 0.1    |
| DISPUTED     | 0.0    |

### Freshness Factor
- If average `lastChecked` age < 7 days: factor = 1.0
- From 7 to 30 days: factor degrades linearly from 1.0 to 0.5
- `freshness_factor = 1.0 - min(1.0, (avg_hours - 168) / (552)) × 0.5`

### Conflict Detection
- Uses existing `resolveSourceConflicts()` from `trust-validation/index.ts`
- Groups facts by `entityId + factKey`
- If multiple facts with different values exist and ≥2 are VERIFIED → DISPUTED

### Score Labels
- 90–100: Very High Confidence
- 75–89: High Confidence
- 50–74: Moderate Confidence
- 0–49: Low Confidence

**Source file:** `backend/src/modules/scoring/trip-trust.ts`

---

## 4. Community Verification State Machine (Feature 5)

### State Transitions
```
VERIFIED ──[N independent reports within time window]──→ NEEDS_REVIEW
NEEDS_REVIEW ──[admin re-verification only]──→ VERIFIED
NEEDS_REVIEW ──[never auto-promoted by report volume]
```

### Threshold Rule
- A single community report on a VERIFIED fact: logged, not downgraded
- ≥3 independent reports (from different users) within 7 days: auto-transition to NEEDS_REVIEW
- NEEDS_REVIEW → VERIFIED: only via explicit admin action (`/admin/facts/:factId/reverify`)

**Source file:** `backend/src/modules/feedback/index.ts`

---

## 5. Group Constraint Blending (Feature 8)

### Hard Constraints (strictest value)
- Accessibility: OR across group (if ANY participant needs wheelchair → enabled)
- Walking tolerance: MIN across group
- Pace: most RELAXED value

### Soft Constraints (proportional blend)
- Interest categories: sorted by vote count across participants
- Transport preference: MIXED if disagreement exists

**Source file:** `backend/src/modules/group/index.ts`
