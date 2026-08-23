# Contributing to FaultForge AI

Thank you for your interest in contributing to **FaultForge AI**! We welcome contributions to help make distributed systems more resilient, observable, and autonomous.

---

## 🛠 Development Setup

1. **Clone & Install**:

   ```bash
   git clone https://github.com/faultforge/faultforge-ai.git
   cd FaultforgeAI
   npm install
   ```

2. **Environment Configuration**:

   ```bash
   cp .env.example .env
   ```

3. **Start Infrastructure**:
   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d
   npm --workspace=@faultforge/database run db:push
   npm --workspace=@faultforge/database run db:seed
   ```

---

## 📐 Development Guidelines

- **Package Manager**: Strictly use **npm** (`npm workspaces`). Do not commit `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`.
- **TypeScript**: Strict mode is enabled (`strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`).
- **Code Quality**:
  - Format code using Prettier: `npm run format`
  - Lint code using ESLint 9: `npm run lint`
  - Strict typechecking: `npm run typecheck`
  - Automated tests: `npm test -- --run`

---

## 🧪 Testing Policy

Every new feature, bug fix, or scenario must include automated tests in `vitest`. Ensure:

1. No `TODO`, placeholder code, or mock omissions.
2. Invariants are strictly asserted (e.g. non-negative stock, single charge execution).
3. 100% test pass rate across all workspace packages.

---

## 📜 Pull Request Process

1. Create a descriptive feature branch: `git checkout -b feat/my-feature`.
2. Follow Conventional Commits format (`feat(...)`, `fix(...)`, `docs(...)`, `test(...)`).
3. Ensure CI passes cleanly before submitting your PR.
