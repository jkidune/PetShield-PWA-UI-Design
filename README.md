
  # PetShield PWA UI Design

  This is a code bundle for PetShield PWA UI Design. The original project is available at https://www.figma.com/design/Sp7U9UJFimGvmQYM3X7LDU/PetShield-PWA-UI-Design.

  # PetShield (MVP) — Offline-First Veterinary Management PWA

PetShield is an **offline-first Progressive Web App (PWA)** for veterinary clinics operating in low-connectivity settings (e.g., rural Tanzania). It enables clinics to register pet owners and animals, schedule and log vaccinations, and send automated reminders using a **hybrid channel fallback** (WhatsApp → SMS → Email).

> **Stack:** React (Vite) + Supabase (PostgreSQL/Auth/RLS) + Supabase Edge Functions (Node.js) + Twilio/Africa’s Talking (optional)

---

## Key Features (MVP)

- **Multi-clinic (multi-tenant) setup** with **Row-Level Security (RLS)** so each clinic’s data is isolated
- **Role-based access**
  - `clinic_admin`: clinic profile + staff management
  - `clinic_staff`: owners/animals/vaccinations/messaging
- **Owner & Animal registration**
- **Vaccination planning**
  - Puppy schedules (2–4 week intervals, configurable doses)
  - Adult schedules (e.g., 12-month intervals)
- **Vaccination logging** (scheduled vs administered date, status, notes)
- **Automated reminders**
  - WhatsApp primary, SMS fallback, Email optional
  - Message templates with variables (owner name, pet name, due date, clinic contact)
- **Gamification**
  - Points awarded when a vaccination is marked complete
- **Reports & exports** (CSV/PDF depending on implementation)
- **Offline-first**
  - Data entry works offline (IndexedDB)
  - Background/manual sync when internet returns

---

## Repository Structure (suggested)



  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
