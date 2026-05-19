AgendaPu

> Pagos recurrentes en pesos, ejecutados con Bitcoin Lightning, fondeados just-in-time desde tu propia wallet.

Hackathon: **La Crypta 2026 — COMMERCE** · Track: *Subscription service (recurring payments)*.
Integra **Wapu** como ramp ARS → Lightning y **NWC** (Nostr Wallet Connect) para que la plata nunca abandone la wallet del usuario hasta el momento exacto del pago.

## Por qué

En Argentina, agendar un pago recurrente en pesos hoy implica o bien delegar custodia a un tercero (riesgo + fricción regulatoria), o bien acordarte de pagar a mano cada mes (no escala). {{PRODUCT_NAME}} cierra ese hueco: vos seguís siendo el custodio de tus sats, la app solo dispara la conversión + el pago Lightning cuando vos confirmás.

## Demo

_Próximamente — GIF + link de Vercel._

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui (preset Nova).
- **Backend:** Supabase (Postgres + Auth + RLS + Edge Functions + `pg_cron`).
- **Lightning:** [Wapu API](https://docs.wapu.io) (fiat ↔ sats) + [`@getalby/sdk`](https://github.com/getAlby/js-sdk) (NWC).
- **Auth:** email/password + cifrado client-side PBKDF2/AES-GCM, opcional Nostr NIP-07 + NIP-44.
- **Tests:** Vitest (unit) + Playwright (1 e2e del flujo de pago).
- **Hosting:** Vercel.

## Custodia y modelo de seguridad

- La API key de Wapu y la NWC connection string del usuario **se cifran en el navegador** antes de viajar a Supabase. El servidor solo ve blobs.
- La clave de cifrado se deriva del password del usuario (PBKDF2) o de su clave Nostr (NIP-44). Sin password / sin NIP-07, no hay forma de descifrar.
- Los sats viven en la wallet Lightning del usuario hasta el momento del pago. {{PRODUCT_NAME}} no tiene fondos custodiados.

## Estado del proyecto

- [x] Fase 0 — Setup (scaffold, schema, infra base).
- [ ] Fase 1 — Auth + crypto.
- [ ] Fase 2 — Clientes Wapu y NWC.
- [ ] Fase 3 — CRUD pagos programados.
- [ ] Fase 4 — Dashboard + ejecución end-to-end.
- [ ] Fase 5 — Histórico + export.
- [ ] Fase 6 — Settings + cleanup.
- [ ] Fase 7 — Tests + polish.
- [ ] Fase 8 — Entrega (deck + PR a `lacrypta/hackathons-2026`).

## Setup local

```bash
cd app
cp .env.example .env.local   # completar SUPABASE_URL, SUPABASE_ANON_KEY
npm install
npm run dev
```

Para la DB:

```bash
# Con Supabase CLI (instalación aparte)
supabase db push  # aplica supabase/migrations/*.sql al proyecto
```

## Tests

```bash
npm run test        # vitest (unit)
npm run test:e2e    # playwright (flujo end-to-end)
```

## Estructura

```
app/                      # frontend (Vite + React)
  src/
    lib/
      crypto/             # PBKDF2 + AES-GCM
      wapu/               # cliente HTTP de Wapu
      nwc/                # cliente NWC (Alby SDK)
      schedule/           # cálculo de next_run, frecuencias
      export/             # CSV / JSON del histórico
      supabase/           # cliente Supabase
    pages/                # rutas
    components/           # UI compartida (+ ui/ de shadcn)
supabase/
  migrations/             # schema + RLS
  functions/              # Edge Functions (compute-next-runs, send-reminders)
```

## Hackathon — créditos

- **Repo de inscripción:** [`lacrypta/hackathons-2026`](https://github.com/lacrypta/hackathons-2026)
- **Sponsor track:** Wapu (+2 puntos por integración).
- **Equipo:** solo dev — Eduardo Alvarez (`eduardoalvarez1812@gmail.com`).
- **Licencia:** [MIT](./LICENSE).
