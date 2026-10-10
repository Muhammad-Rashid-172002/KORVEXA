# Glasswork — Database ERD

PostgreSQL 17 · Drizzle ORM. Conventions (DECISIONS D-005..D-007):

- `id uuid` (UUIDv7) primary keys; `created_at` / `updated_at timestamptz`.
- Money: `*_amount bigint` (minor units) + `currency char(3)`.
- `is_seed boolean` on user-generated tables (dev seed only).
- Soft delete only where legally needed (`deleted_at`). Money and audit tables are append-only.

The ERD is split by domain so each diagram stays readable. Tables marked **(P0)** are created in Phase 0; the rest arrive in the phase that needs them, but the enums are defined up front.

---

## 1. Identity, auth & organisations

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ accounts : "OAuth links"
    users ||--|| profiles : has
    users ||--o{ org_members : "member of"
    organizations ||--o{ org_members : has
    users ||--o| seller_profiles : "may have"
    organizations ||--o| seller_profiles : "agency seller"
    seller_profiles ||--o{ seller_skills : has
    skills ||--o{ seller_skills : tagged
    seller_profiles ||--o{ portfolio_items : shows
    portfolio_items }o--o{ files : media
    users ||--o{ verifications : "badges"
    users ||--o{ files : uploads

    users {
        uuid id PK
        text email UK "citext"
        bool email_verified
        text name
        text image
        user_role[] roles "buyer|seller|admin|support"
        admin_scope[] admin_scopes "product|growth|operations"
        active_mode active_mode "buyer|seller"
        bool two_factor_enabled
        timestamptz banned_at
        bool is_seed
    }
    sessions {
        uuid id PK
        uuid user_id FK
        text token UK "hashed"
        timestamptz expires_at
        text ip_address
        text user_agent
    }
    accounts {
        uuid id PK
        uuid user_id FK
        text provider_id "credential|google|github"
        text account_id
        text password_hash "argon2id, credential only"
        text access_token "encrypted"
        text refresh_token "encrypted"
    }
    auth_tokens {
        uuid id PK
        text identifier "email verify / reset / OTP"
        text value "hashed"
        timestamptz expires_at
    }
    profiles {
        uuid user_id PK, FK
        text display_name
        text headline
        text bio
        text country "ISO-3166"
        text timezone
        text[] languages
    }
    organizations {
        uuid id PK
        text name
        text slug UK
        org_kind kind "buyer_team|seller_agency"
        uuid owner_id FK
    }
    org_members {
        uuid org_id PK, FK
        uuid user_id PK, FK
        org_role role "owner|admin|member"
        timestamptz invited_at
        timestamptz joined_at
    }
    seller_profiles {
        uuid id PK
        uuid user_id FK "nullable if agency"
        uuid org_id FK "nullable if individual"
        text title
        int hourly_rate_amount
        char currency
        seller_level level
        payout_rail payout_rail "stripe_connect|global_payouts|payoneer|manual_bank"
        text payout_account_ref
        bool operated_by_platform "KorvenzaTech label, never a ranking input"
        onboarding_status onboarding_status
    }
    skills {
        uuid id PK
        text slug UK
        text name
        uuid category_id FK
    }
    seller_skills {
        uuid seller_id PK, FK
        uuid skill_id PK, FK
        smallint years
    }
    portfolio_items {
        uuid id PK
        uuid seller_id FK
        text title
        text description
        text url
        bool reviewed "Portfolio reviewed badge"
    }
    verifications {
        uuid id PK
        uuid user_id FK
        verification_kind kind "identity|github|play_store|app_store|portfolio|skill_test"
        verification_status status "pending|verified|rejected|revoked"
        jsonb evidence
        uuid reviewed_by FK
        timestamptz verified_at
    }
    files {
        uuid id PK
        uuid owner_id FK
        text storage_key UK
        text mime_type
        bigint size_bytes
        file_purpose purpose "avatar|portfolio|deliverable|message|evidence"
        file_status status "pending|uploaded|clean|infected"
        text sha256
    }
```

**(P0):** `users`, `sessions`, `accounts`, `auth_tokens`, `profiles`, `files`, `audit_logs`.

---

## 2. Catalogue & discovery

```mermaid
erDiagram
    categories ||--o{ categories : parent
    categories ||--o{ services : contains
    seller_profiles ||--o{ services : offers
    services ||--|{ service_packages : "Basic/Standard/Premium"
    services ||--o{ service_extras : offers
    services ||--o{ service_faqs : has
    services }o--o{ files : gallery
    users ||--o{ favorites : saves
    services ||--o{ favorites : "saved by"
    users ||--o{ saved_searches : saves
    users ||--o{ briefs : posts
    briefs ||--o{ proposals : receives
    seller_profiles ||--o{ proposals : sends

    categories {
        uuid id PK
        uuid parent_id FK
        text slug UK
        text name
    }
    services {
        uuid id PK
        uuid seller_id FK
        uuid category_id FK
        text slug UK
        text title
        text description
        jsonb requirements_form
        service_status status "draft|pending_review|live|paused|rejected"
        tsvector search_vector
    }
    service_packages {
        uuid id PK
        uuid service_id FK
        package_tier tier "basic|standard|premium"
        bigint price_amount
        char currency
        int delivery_days
        int revisions
        jsonb milestone_template
    }
    service_extras {
        uuid id PK
        uuid service_id FK
        text title
        bigint price_amount
        int extra_days
    }
    service_faqs {
        uuid id PK
        uuid service_id FK
        text question
        text answer
    }
    favorites {
        uuid user_id PK, FK
        uuid service_id PK, FK
    }
    saved_searches {
        uuid id PK
        uuid user_id FK
        jsonb query
        bool notify
    }
    briefs {
        uuid id PK
        uuid buyer_id FK
        uuid org_id FK
        text title
        jsonb structured "goals, stories, platforms, integrations"
        bigint budget_min_amount
        bigint budget_max_amount
        char currency
        bool ai_generated
        brief_status status "draft|open|closed"
    }
    proposals {
        uuid id PK
        uuid brief_id FK
        uuid seller_id FK
        text cover_letter
        jsonb milestone_plan
        bigint total_amount
        char currency
        proposal_status status "sent|withdrawn|accepted|declined"
    }
```

---

## 3. Projects, milestones & the Project Room

```mermaid
erDiagram
    projects ||--o{ project_participants : has
    users ||--o{ project_participants : joins
    projects ||--|{ milestones : "ordered"
    milestones ||--o{ tasks : "board items"
    tasks ||--o{ task_comments : has
    milestones ||--o{ deliverables : "versions"
    deliverables ||--o{ deliverable_feedback : "pinned feedback"
    deliverables }o--|| files : file
    projects ||--o{ preview_links : has
    projects ||--o{ repo_links : has
    projects ||--o{ change_requests : has
    projects ||--o{ project_events : "activity feed"
    projects ||--o| conversations : "project chat"
    projects ||--o{ meetings : has
    services ||--o{ projects : "ordered from"
    proposals ||--o| projects : "accepted into"

    projects {
        uuid id PK
        text code UK "GW-0001"
        uuid buyer_id FK
        uuid buyer_org_id FK
        uuid seller_id FK
        uuid service_id FK "nullable"
        uuid package_id FK "nullable"
        uuid proposal_id FK "nullable"
        text title
        project_status status "see STATE_MACHINE.md"
        project_status status_before_side "for resume from paused/disputed"
        health health "on_track|at_risk|blocked"
        text health_reason
        bigint total_amount
        char currency
        timestamptz started_at
        timestamptz completed_at
    }
    project_participants {
        uuid project_id PK, FK
        uuid user_id PK, FK
        participant_role role "buyer|buyer_member|seller|seller_member|admin_observer"
    }
    milestones {
        uuid id PK
        uuid project_id FK
        smallint position
        text title
        text acceptance_criteria
        bigint amount "weight for % progress"
        char currency
        milestone_status status
        date planned_start
        date planned_due
        timestamptz actual_submitted_at
        timestamptz approved_at
        timestamptz auto_approve_at
        smallint revision_count
    }
    tasks {
        uuid id PK
        uuid milestone_id FK
        text title
        task_status status "todo|in_progress|in_review|done"
        int sort_order
        uuid assignee_id FK
        task_source source "manual|meeting_ai"
    }
    task_comments {
        uuid id PK
        uuid task_id FK
        uuid author_id FK
        text body
    }
    deliverables {
        uuid id PK
        uuid milestone_id FK
        int version
        uuid file_id FK
        text note
        deliverable_status status "submitted|approved|revision_requested|superseded"
        uuid submitted_by FK
    }
    deliverable_feedback {
        uuid id PK
        uuid deliverable_id FK
        uuid author_id FK
        jsonb anchor "page/region/timecode"
        text body
        bool resolved
    }
    preview_links {
        uuid id PK
        uuid project_id FK
        uuid milestone_id FK
        preview_kind kind "staging|figma|apk|testflight|video|other"
        text url
        timestamptz last_updated_at
    }
    repo_links {
        uuid id PK
        uuid project_id FK
        text provider "github"
        text repo_full_name
        bigint installation_id
    }
    change_requests {
        uuid id PK
        uuid project_id FK
        uuid requested_by FK
        text description
        bigint price_delta_amount
        int days_delta
        jsonb milestone_changes
        change_request_status status "proposed|accepted|declined|withdrawn"
    }
    project_events {
        uuid id PK
        uuid project_id FK
        uuid actor_id FK
        text type "milestone.submitted, task.moved, ..."
        jsonb payload
        timestamptz created_at
    }
```

---

## 4. Communication

```mermaid
erDiagram
    conversations ||--o{ conversation_members : has
    users ||--o{ conversation_members : in
    conversations ||--o{ messages : contains
    messages }o--o{ files : attachments
    projects ||--o{ meetings : schedules
    meetings }o--o| files : recording
    users ||--o{ notifications : receives
    users ||--o{ notification_preferences : sets

    conversations {
        uuid id PK
        conversation_kind kind "direct|project"
        uuid project_id FK "nullable"
    }
    conversation_members {
        uuid conversation_id PK, FK
        uuid user_id PK, FK
        uuid last_read_message_id
    }
    messages {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        text body
        message_kind kind "text|custom_offer|system"
        jsonb safety_flags "off-platform contact/payment detected"
        timestamptz edited_at
    }
    meetings {
        uuid id PK
        uuid project_id FK
        text provider "livekit|daily"
        text room_ref
        timestamptz scheduled_at
        bool recording_consented
        uuid recording_file_id FK
        text ai_notes
    }
    notifications {
        uuid id PK
        uuid user_id FK
        text type
        jsonb payload
        timestamptz read_at
    }
    notification_preferences {
        uuid user_id PK, FK
        text type PK
        bool in_app
        bool email
        bool push
    }
```

---

## 5. Money (all amounts bigint minor units)

```mermaid
erDiagram
    milestones ||--o{ payments : "funded by"
    payments ||--o| escrow_holds : creates
    milestones ||--o| escrow_holds : "held for"
    escrow_holds ||--o{ transfers : "released via"
    seller_profiles ||--o{ transfers : receives
    seller_profiles ||--o{ payouts : "paid out"
    payouts }o--o{ transfers : batches
    ledger_transactions ||--|{ ledger_entries : "sum = 0"
    ledger_accounts ||--o{ ledger_entries : posts
    payments ||--o| invoices : receipt
    users ||--o{ invoices : billed
    webhook_events ||--o| payments : updates

    payments {
        uuid id PK
        uuid milestone_id FK
        uuid payer_id FK
        bigint amount "milestone price"
        bigint buyer_fee_amount
        char currency
        text provider "stripe"
        text provider_ref UK "PaymentIntent id"
        payment_status status "pending|succeeded|failed|refunded|partially_refunded"
        text idempotency_key UK
    }
    escrow_holds {
        uuid id PK
        uuid milestone_id FK, UK
        uuid payment_id FK
        bigint amount
        char currency
        escrow_status status "held|released|refunded|split|disputed"
        timestamptz released_at
    }
    transfers {
        uuid id PK
        uuid escrow_hold_id FK
        uuid seller_id FK
        bigint gross_amount
        bigint seller_fee_amount
        bigint net_amount
        char currency
        transfer_status status "pending|completed|failed|reversed"
    }
    payouts {
        uuid id PK
        uuid seller_id FK
        payout_rail rail
        bigint amount
        char currency
        text provider_ref
        payout_status status "requested|processing|paid|failed"
        uuid approved_by FK "manual_bank only"
    }
    ledger_accounts {
        uuid id PK
        text code UK "platform_cash, escrow:{milestone}, seller_payable:{seller}, platform_revenue, payout_clearing, refunds"
        ledger_account_type type "asset|liability|revenue|expense"
        char currency
    }
    ledger_transactions {
        uuid id PK
        text kind "charge|release|fee|payout|refund|adjustment"
        text reference_type
        uuid reference_id
        text idempotency_key UK
        timestamptz created_at
    }
    ledger_entries {
        uuid id PK
        uuid transaction_id FK
        uuid account_id FK
        bigint amount "signed: + debit / - credit"
        char currency
    }
    invoices {
        uuid id PK
        text number UK "GW-INV-2026-000001"
        uuid user_id FK
        uuid payment_id FK
        jsonb line_items "fee breakdown"
        uuid pdf_file_id FK
    }
    webhook_events {
        uuid id PK
        text provider
        text event_id UK
        text type
        jsonb payload "raw"
        timestamptz processed_at
        text error
    }
    idempotency_keys {
        text key PK
        uuid user_id FK
        text request_hash
        jsonb response
        timestamptz expires_at
    }
```

---

## 6. Trust, admin & platform

```mermaid
erDiagram
    projects ||--o{ reviews : receives
    milestones ||--o{ reviews : "private per-milestone"
    reviews ||--o| review_replies : "one seller reply"
    projects ||--o{ disputes : "may have"
    disputes ||--o{ dispute_evidence : collects
    dispute_evidence }o--o| files : file
    users ||--o{ reports : files
    users ||--o{ audit_logs : "actor"
    users ||--o{ ai_usage : consumes

    reviews {
        uuid id PK
        uuid project_id FK
        uuid milestone_id FK "null = final public review"
        uuid author_id FK
        uuid subject_seller_id FK
        review_visibility visibility "private|public"
        smallint rating_overall
        smallint rating_communication
        smallint rating_quality
        smallint rating_timeliness
        text body
    }
    review_replies {
        uuid review_id PK, FK
        uuid author_id FK
        text body
    }
    disputes {
        uuid id PK
        uuid project_id FK
        uuid milestone_id FK
        uuid opened_by FK
        text reason
        dispute_status status "open|under_review|resolved|withdrawn"
        dispute_outcome outcome "release|refund|split"
        bigint refund_amount
        uuid resolved_by FK
        jsonb case_file "auto-collected snapshot"
    }
    dispute_evidence {
        uuid id PK
        uuid dispute_id FK
        uuid submitted_by FK
        evidence_kind kind "message|deliverable|approval|change_request|timeline|upload"
        uuid ref_id
        uuid file_id FK
    }
    reports {
        uuid id PK
        uuid reporter_id FK
        text target_type "user|service|message|review"
        uuid target_id
        text reason
        report_status status "open|actioned|dismissed"
    }
    audit_logs {
        uuid id PK
        uuid actor_id FK "null = system"
        text action "project.transition, payout.approve, ..."
        text entity_type
        uuid entity_id
        jsonb before
        jsonb after
        text ip
        text request_id
        timestamptz created_at
    }
    platform_settings {
        text key PK "fees.buyer_pct, milestones.auto_approve_days, ..."
        jsonb value
        uuid updated_by FK
    }
    feature_flags {
        text key PK
        bool enabled
        jsonb rules
    }
    ai_usage {
        uuid id PK
        uuid user_id FK
        text feature "brief_builder|matching|report|meeting_notes"
        int input_tokens
        int output_tokens
        bigint cost_micros
        date day
    }
```

---

## Key integrity rules (enforced in DB, not just in code)

- `ledger_entries`: deferred constraint trigger checks that `SUM(amount) = 0` per `transaction_id` and currency; UPDATE/DELETE revoked from the app role.
- `audit_logs`, `project_events`, `webhook_events`: append-only (the app role has no UPDATE/DELETE).
- `escrow_holds.milestone_id` unique: one hold per milestone funding. Re-funding after a change request creates a new milestone.
- `reviews`: unique `(project_id, author_id, milestone_id)`; insert allowed only when the project is `completed` (public review) or the milestone is `released` (private feedback). Checked in the service and backed by a trigger.
- All FK columns indexed; `services.search_vector` GIN; `pg_trgm` GIN on `services.title` and `profiles.display_name`.
