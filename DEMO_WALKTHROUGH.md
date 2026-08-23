# FaultForge AI — Interactive Portfolio Demo Walkthrough

Follow this step-by-step walkthrough to demonstrate the full end-to-end capabilities of **FaultForge AI** to hiring managers, staff engineers, and SRE leaders.

---

## 🎯 Demo Storyline: "The Midnight Flash Sale Race Condition"

**Scenario**: A high-traffic marketing campaign causes customer checkouts to race, inducing negative inventory overselling. FaultForge AI detects the anomaly, deploys multi-agent investigation specialists, adjudicates patches under double-blind evaluation, requests human approval, and conducts a 4-step progressive canary rollout.

---

### Step 1: Login & Select Tenant Workspace

1. Navigate to `http://localhost:5173`.
2. Login with role:
   - **Admin / SRE Lead**: `admin@faultforge.local`
   - **AI Reviewer**: `reviewer@faultforge.local`
3. View the **Active Incidents Dashboard** and Lab Microservice Health indicators.

---

### Step 2: Inject Controlled Chaos (`COMMERCE_RACE_CONDITION`)

1. Click **"New Incident"** $\rightarrow$ Select **"Commerce Lab"**.
2. Select scenario **`COMMERCE_RACE_CONDITION`** (Inventory Overselling Race Condition).
3. Click **"Inject Fault & Start Investigation"**.
4. The system:
   - Creates `IncidentRun` with status `INITIATED`.
   - Inserts transactional outbox event.
   - Background worker processes event and advances status to `INVESTIGATING`.

---

### Step 3: Enter the Incident War Room

1. Open the created Incident in the **War Room** (`/incidents/:id`).
2. Observe live telemetry:
   - **W3C Trace Timeline**: Latency injection gap between read and write operations.
   - **Prometheus Metrics**: Stock balance drops below zero ($stock = -3$).
   - **Specialist Agent Timeline**:
     - `TriageAgent`: Identifies TOCTOU vulnerability in checkout handler (Confidence: 98%).
     - `BackendAgent`: Synthesizes atomic conditional decrement SQL patch.
     - `VerificationAgent`: Asserts zero regressions across concurrency stress tests.
     - `SafetyAgent`: Verifies patch contains no SQL injection or authorization bypasses.

---

### Step 4: Double-Blind Solution Arena & 100-Point Rubric

1. Navigate to the **AI Solution Evaluation Arena** tab.
2. Observe cryptographic anonymization:
   - **Candidate ALPHA (Blinded)** vs **Candidate BETA (Blinded)**.
3. Review 100-point rubric breakdown:
   - Candidate ALPHA (Mutex Lock): 90/100 (Penalized for 25ms lock contention latency).
   - Candidate BETA (Atomic SQL Decrement): 100/100 (Optimal sub-millisecond latency, zero contention).
4. System automatically recommends **Candidate BETA** as the winning patch.

---

### Step 5: Human Approval Gate (Four-Eyes Principle)

1. Switch user / verify reviewer credentials (`reviewer@faultforge.local`).
2. Verify that self-approval is rejected by ABAC guard.
3. Review code diff in the interactive **Monaco Diff Viewer**:
   ```diff
   - store.unsafeSetStock(productId, currentStock - 1);
   + const success = store.atomicDecrementStock(productId, 1);
   ```
4. Click **"Approve Patch"** with rationale $\rightarrow$ Incident status advances to `APPROVED`.

---

### Step 6: Progressive Canary Rollout & Telemetry Verification

1. Click **"Start Progressive Canary Rollout"**.
2. Watch progressive 4-step deployment:
   - **5% Traffic**: Error rate: 0.05%, P95 Latency: 3.2ms $\rightarrow$ [Healthy]
   - **25% Traffic**: Error rate: 0.05%, P95 Latency: 3.4ms $\rightarrow$ [Healthy]
   - **50% Traffic**: Error rate: 0.06%, P95 Latency: 3.5ms $\rightarrow$ [Healthy]
   - **100% Full Promotion**: Error rate: 0.05%, P95 Latency: 3.5ms $\rightarrow$ [Healthy]
3. Incident transitions to **`RESOLVED`**.

---

### Step 7: Verified Reference Library & SRE Postmortem

1. Click **"Publish to Reference Library"**.
2. View compiled case study in the **Reference Solutions Library** (`/reference-library`).
3. View auto-generated **Google SRE Postmortem**:
   - Executive summary
   - Root cause analysis
   - Verified code diff
   - Preventative action items and owner assignments
