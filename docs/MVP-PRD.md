# 🌊 Coral Action Attestation MVP — Product Requirements Document (PRD)

**Version:** v0.1 (MVP)
**Last Updated:** October 17, 2025

---

## 🎯 Product Overview

Enable marine researchers, NGOs, and community projects to record, verify, and publicly display coral restoration actions as on-chain attestations.

---

## 🧩 System Components

| Component                       | Tech                                    | Purpose                                                                    |
| ------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| **Frontend (Next.js)**          | Next.js + Wagmi + Ethers + Maplibre     | User interface for login, form submission, profile, and map visualization. |
| **Backend (Supabase Cloud)**    | PostgreSQL + Supabase Auth + API routes | Data persistence layer for profiles, attestations, and reference tables.   |
| **Relayer (Cloudflare Worker)** | TypeScript + EAS SDK + ethers.js        | Verifies delegated signatures and posts attestations on-chain.             |
| **Blockchain (EAS)**            | Ethereum Attestation Service            | Immutable record for coral restoration attestations.                       |

---

## 👤 User Types

| Role                          | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| **Researcher / Organization** | Creates profile and submits coral restoration attestations. |
| **Public Viewer**             | Views profiles, attestation map, and proof of work.         |
| **Admin (optional)**          | Manages coral species list and schema updates.              |

---

## 🧠 User Flow

### 1️⃣ Onboarding / Login

* Connect MetaMask wallet.
* Backend checks if wallet exists in profiles.
* If not, prompt user to create a profile.

### 2️⃣ Attestation Submission

* User fills attestation form (regen type, location, date, depth, surface area, species, summary, contributor).
* App stores attestation draft in Supabase.
* User signs delegated message → sent to relayer.
* Relayer posts attestation → returns UID.
* UID stored in Supabase.

### 3️⃣ Map Visualization

* Fetch all attestations.
* Display interactive markers on MapLibre.

### 4️⃣ Profile Page

* Public route `/profile/[handle]` displays profile details and attestation history.

---

## 🗄️ Database Schema (Supabase)

### Table: `profiles`

| Column         | Type      | Notes                           |
| -------------- | --------- | ------------------------------- |
| id             | uuid (PK) | Auto                            |
| wallet_address | string    | Unique, case-sensitive          |
| org_name       | string    | Organization or researcher name |
| website        | string    | Optional                        |
| description    | text      |                                 |
| handle         | string    | Auto-generated, editable        |

### Table: `attestations`

| Column           | Type                                        | Notes                                           |
| ---------------- | ------------------------------------------- | ----------------------------------------------- |
| id               | uuid (PK)                                   | Auto                                            |
| uid              | string                                      | EAS attestation UID                             |
| profile_id       | uuid (FK)                                   | references `profiles.id`                        |
| regen_type       | enum('transplantation', 'nursery', 'other') |                                                 |
| action_date      | date                                        |                                                 |
| location_lat     | decimal                                     |                                                 |
| location_lng     | decimal                                     |                                                 |
| depth            | numeric                                     | meters                                          |
| surface_area     | numeric                                     | m²                                              |
| species          | text[]                                      | multi-select from predefined coral species list |
| summary          | text                                        |                                                 |
| contributor_name | text[]                                      | array of contributor names                      |
| created_at       | timestamp                                   | default now()                                   |

### Table: `coral_species`

| Column      | Type      | Notes           |
| ----------- | --------- | --------------- |
| id          | uuid (PK) | Auto            |
| common_name | string    | Display name    |
| latin_name  | string    | Scientific name |

#### Initial Placeholder Data (10 options)

1. Elkhorn coral (*Acropora palmata*)
2. Brain coral (*Diploria labyrinthiformis*)
3. Bubble coral (*Plerogyra sinuosa*)
4. Mushroom coral (*Fungia fungites*)
5. Acropora palmata (*Acropora palmata*)
6. Grooved brain coral (*Diploria strigosa*)
7. Tube coral (*Tubastraea coccinea*)
8. Black coral (*Antipatharia*)
9. Finger coral (*Porites porites*)
10. Star coral (*Montastraea cavernosa*)

---

## 🧾 EAS Schema (on-chain)

| Field       | Type    | Description               |
| ----------- | ------- | ------------------------- |
| recipient   | address | Recipient of attestation  |
| regenType   | string  | Enum mapped from frontend |
| location    | string  | Encoded “lat,long”        |
| actionDate  | uint256 | Timestamp                 |
| depth       | uint256 | Meters                    |
| surfaceArea | uint256 | m²                        |
| species     | string  | Comma-separated list      |
| summary     | string  | Summary of activity       |
| contributor | string  | Contributor’s name        |

---

## ⚙️ API / Integration Points

(Relyaer already been deployed during POC stage)

**Relayer Endpoint:** `/api/attest`
**Method:** POST

```ts
{
  signature: string,
  message: {
    schema: string,
    recipient: string,
    data: string,
    refUID?: string,
    deadline?: number
  }
}
```

**Response:**

```ts
{
  uid: string,
  txHash: string
}
```

---

## 🧱 Frontend Architecture

| Page    | Route               | Description                          |
| ------- | ------------------- | ------------------------------------ |
| Home    | `/`                 | Overview & CTA to attest             |
| Attest  | `/attest`           | Form for submitting attestations     |
| Map     | `/map`              | Public map visualization             |
| Profile | `/profile/[handle]` | Public profile with attestation list |

**Shared components:** Wallet Connect, Attestation Form, Map Pins, Profile Card, Attestation List.

---

## 🗓️ Development Phases & Task Breakdown

### **Phase 1 — Core Infrastructure and backend **

### **Phase 2 - Prepare EAS schema***

### **Phase 3 — Frontend Foundations **
### **Phase 4 — Relayer Integration & update EAS schema pointer **
### **Phase 5 - Frontend integration ***



### **Phase 6 — Visualization & Profiles **

*

### **Phase 7 — QA & Launch (Week 5)**

*

---

## 🔮 Future Iterations (Post-MVP)

* IPFS / Storacha for dataset storage
* Embedded wallet onboarding


---

**End of Document**
