# AI Agent Operating Rules: Meta-Hub Protocol (GENZTECH MARKETING)

These rules govern all autonomous and semi-autonomous actions performed by the AI agent within the Meta-Hub ecosystem. Violation of these rules is a critical system failure.

## 1. API & Architecture Boundaries
- **Internal APIs Only**: The agent MUST NEVER make direct calls to the Facebook Graph/Marketing APIs. It MUST use the designated internal backend services (e.g., `/api/v1/meta/posts`) which handle encryption, logging, and rate-limiting.
- **Permission Validation**: Before executing any write action, the agent MUST verify that the active session has the specific scope required (e.g., `ads_management`).

## 2. Facebook Platform Compliance (Zero-Spam Policy)
- **Rate-Limit Awareness**: The agent must stagger actions to avoid triggering Facebook's spam detection. Never perform more than 5 content-related actions per minute without user override.
- **Authentic Interaction**: Chatbot responses must be clearly distinguishable as automated or follow the "Handover Protocol" to a human agent when intent is complex.
- **Content Integrity**: NEVER post duplicate content across multiple pages simultaneously (anti-spam trigger). Each post must be unique or scheduled with significant time offsets.

## 3. Financial & Ads Responsibility
- **Budget Lock**: The agent MUST NEVER increase an ad set's daily or lifetime budget without explicit, one-time permission from the human user.
- **Spending Alerts**: The agent must proactively notify the user if an ad set is consuming budget exponentially faster than the historical 7-day average.
- **No Intent Assumption**: "Optimize ads" does NOT mean "Increase budget". It means "Reallocate existing budget" or "Tune targeting parameters".

## 4. Data Security & Privacy (Operational)
- **Token Exclusion**: Access tokens, client secrets, and PII MUST NEVER be printed in logs, displayed in the terminal UI, or summarized in "Dreams" or memory files.
- **Memory Management**: When writing to `MEMORY.md` or session logs, redact any sensitive strings that look like hash keys or temporary secrets.

## 5. Decision Making & User Interaction
- **Ambiguity = Pause**: If a user's request could have a destructive or financial impact and isn't 100% clear, the agent MUST ask for clarification.
- **Safety Mode**: By default, all "Delete" or "Pause Campaign" actions require a confirmation step unless "Aggressive Automation" mode is explicitly enabled by the user in `product.md`.
- **System Synchronization**: All UI changes MUST strictly adhere to the `DESIGN.md` tokens. NEVER introduce ad-hoc styles.

## 6. Coding Standards
- **Refensive Programming**: Always check for `null` or `undefined` when parsing Meta API responses.
- **Traceability**: Every autonomous action must be tagged with a reason code (e.g., `REASON: USER_REQUEST` or `REASON: AD_PERFORMANCE_TRIGGER`).

## AI Code Modification Rules (STRICT)

You are modifying an existing codebase. Your primary goal is to make minimal, safe changes WITHOUT breaking the UI layout or structure.

---

### 1. UI Constraints (CRITICAL - DO NOT BREAK)

* The layout structure must remain unchanged
* No element may overlap and hide another unintentionally
* Main content must always be fully visible
* Do NOT introduce layout shifts or broken spacing
* Avoid fixed heights that can cause content cutoff
* The UI must remain responsive

---

### 2. Layout Structure (SOURCE OF TRUTH)

* Header (top)
* Sidebar (left)
* Main content (scrollable)
* These layers must NOT overlap unless explicitly required

---

### 3. Positioning Rules

* Prefer Flexbox or Grid for layout
* Avoid `position: absolute` unless explicitly required
* If using `absolute`, parent must be `relative` and properly bounded
* Do NOT use `height: 100vh` or fixed heights in content areas
* Do NOT modify z-index unless necessary and justified

---

### 4. Forbidden Changes

* Do NOT restructure layout hierarchy
* Do NOT wrap components in unnecessary extra elements
* Do NOT modify global styles or unrelated components
* Do NOT refactor working layout code
* Do NOT change positioning strategy (e.g., flex → absolute)

---

### 5. Scope Control

* Only modify the specific component or file requested
* Do NOT touch unrelated files or shared layout components
* Keep changes minimal and localized

---

### 6. Visual Safety Checklist (MANDATORY BEFORE FINISHING)

* No overlapping elements
* No hidden or cut-off content
* No broken scroll behavior
* Layout remains consistent with original design

---

### 7. Required Reasoning (BEFORE CODING)

You MUST:

* Explain what you will change
* Explain why it will NOT break layout
* Identify any potential UI risks

---

### 8. Critical Fallback Rule

If you are NOT 100% sure your change is safe for the layout:
→ DO NOT modify the layout
→ Ask for clarification instead

---

### 9. Guiding Principle

Preserve stability over optimization.
Small safe changes are ALWAYS better than large risky refactors.


## AI Safe Editing Rules (STRICT ISOLATION MODE)

You are working in a large codebase with multiple independent UI modules (e.g., landing page, dashboard, admin).

Your job is to modify ONLY the requested module and NEVER affect others.

---

### 1. Module Isolation (CRITICAL)

Each module is independent:

* Landing page (ladi)
* Dashboard
* Admin panel

You MUST treat them as completely separate systems.

---

### 2. Strict Scope Rule

* ONLY modify files directly related to the requested feature
* NEVER modify files outside the current module
* NEVER "clean up", "refactor", or "improve" unrelated code

Example:
If task = dashboard → DO NOT touch landing page (ladi)

---

### 3. Forbidden Behavior

* Do NOT edit shared components unless explicitly required
* Do NOT apply global CSS changes
* Do NOT rename or restructure shared layout
* Do NOT fix unrelated bugs

---

### 4. Dependency Awareness

Before editing:

* Identify which module the file belongs to
* Check if the file is shared across modules

If shared → DO NOT MODIFY unless explicitly instructed

---

### 5. Change Minimization

* Make the smallest possible change
* Avoid touching working code
* Do not reformat or rewrite existing code

---

### 6. Self-Check Before Finishing

* Did I modify any file outside the target module? → If YES, revert
* Could this change affect another page/module? → If YES, stop
* Did I introduce global side effects? → If YES, fix

---

### 7. Critical Rule

If unsure whether a file affects other modules:
→ DO NOT MODIFY

---

### 8. Mindset

You are performing a surgical edit, NOT a refactor.
