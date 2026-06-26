
# Architectural Guide — Node.js Modular Monolith (DDD + TDD)

> **Audience:** AI agents and developers starting a new service.
> **Purpose:** Pre-establish folder allocation, naming conventions, and shared contracts so cognitive load stays on domain logic — not structural decisions.
> **Philosophy:** The core (domain + application) is infrastructure-agnostic. Persistence, auth, HTTP frameworks, and DI containers are adapters — they satisfy contracts defined by the core, never the other way around.

---

## Foundational Rule

> **Nothing in `domain/` or `application/` may import from `infra/`, from any third-party framework, or from any Node built-in with side effects (fs, net, crypto used for hashing, etc.).**

If a domain concept needs a capability (hashing, token generation, storage, time), it expresses that need as an interface in `shared/contracts/`. The infra layer provides the implementation. The DI container wires them together at bootstrap — and the container itself is never called from the core.

---

## Stack Profiles — Choose One Per Project

Declare the project's **stack profile** at bootstrap. Every conditional decision in this guide is keyed to one of these two options.

| Profile | Rendering | Auth mechanism | Environments |
|---|---|---|---|
| **`view-engine`** | Server-side HTML rendered by the HTTP framework | Stateful — secure HTTP-only cookies + server session | Single process, single host |
| **`spa`** | External client framework (React, Vue, etc.) | Stateless — token-based (e.g. JWT) | Two environments: `client/` and `server/` |

> The domain core (`src/modules/`, `src/shared/`) is **identical in both profiles**. Only the infra adapters differ.

---

## Part I — Macro Structure

### Mental Model

```
                        ┌─────────────────────────────────┐
                        │           shared/               │
                        │  Contracts · Errors · Result    │
                        └────────────────┬────────────────┘
                                         │ implements
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
     ┌────────▼────────┐      ┌──────────▼──────────┐   ┌──────────▼──────────┐
     │   domain/       │      │   application/      │   │      infra/         │
     │ Entities        │◄─────│ Use Cases · DTOs    │   │ Adapters · Drivers  │
     │ Value Objects   │      │ IUseCase impl       │   │ HTTP · DB · Auth    │
     │ Domain Events   │      └─────────────────────┘   │ DI Container        │
     └─────────────────┘                                 └─────────────────────┘

One process → Many modules → Zero direct cross-module imports
Core never calls infra → Infra always depends on core contracts
```

### Zone Map

| Zone | Path | Rule |
|---|---|---|
| Shared Kernel | `src/shared/` | No business logic. No infra imports. Visible to all layers. |
| Domain | `src/modules/<domain>/domain/` | No infra. No application imports. Pure business rules. |
| Application | `src/modules/<domain>/application/` | Orchestrates domain. Depends only on `shared/` contracts. |
| Infrastructure | `src/modules/<domain>/infra/` and `src/infra/` | Implements contracts. May import any library. |

---

### Top-Level Folder Tree

```
src/
├── shared/
│   ├── contracts/
│   │   ├── http/
│   │   │   ├── IController.ts
│   │   │   ├── IHttpRequest.ts
│   │   │   └── IHttpResponse.ts
│   │   ├── usecase/
│   │   │   └── IUseCase.ts
│   │   ├── repository/
│   │   │   └── IRepository.ts
│   │   ├── auth/
│   │   │   └── IAuthStrategy.ts
│   │   ├── container/
│   │   │   └── IContainer.ts
│   │   └── events/
│   │       ├── IDomainEvent.ts
│   │       └── IEventHandler.ts
│   ├── errors/
│   │   ├── AppError.ts
│   │   └── DomainError.ts
│   ├── result/
│   │   └── Result.ts
│   ├── logger/
│   │   └── ILogger.ts              # Contract only — implementation is in infra
│   └── utils/
│       └── (pure functions, no side effects, no imports from infra)
│
├── modules/
│   └── <domain>/
│       ├── domain/
│       │   ├── entities/
│       │   ├── value-objects/
│       │   └── events/
│       ├── application/
│       │   ├── use-cases/
│       │   └── dtos/
│       ├── infra/
│       │   ├── http/
│       │   │   ├── routes.ts
│       │   │   └── controllers/
│       │   ├── repositories/       # Concrete persistence adapters
│       │   └── mappers/
│       └── tests/
│           ├── unit/
│           ├── integration/
│           └── fakes/              # In-memory implementations of shared/ contracts
│
└── infra/
    ├── http/
    │   ├── app.ts                  # HTTP framework factory (no listen() call)
    │   ├── adapter.ts              # Bridges IController ↔ HTTP framework
    │   └── middlewares/
    │       ├── auth.middleware.ts  # Delegates to IAuthStrategy
    │       └── error.middleware.ts
    ├── auth/                       # IAuthStrategy implementations
    │   ├── CookieAuthStrategy.ts   # [view-engine]
    │   └── TokenAuthStrategy.ts    # [spa]
    ├── persistence/                # IRepository implementations (one subfolder per driver)
    │   ├── knex/                   # e.g. KnexUserRepository
    │   └── mongoose/               # e.g. MongooseUserRepository
    ├── container/
    │   └── container.ts            # DI wiring — only file that knows all concrete classes
    ├── logger/
    │   └── PinoLogger.ts           # Implements ILogger
    ├── events/
    │   └── EventBus.ts
    ├── telemetry/
    │   └── tracer.ts
    └── server.ts                   # Entry point — binds port, calls listen()
```

---

### Profile: `view-engine` — Additional Infra Structure

```
src/infra/http/
├── views/                          # Templates (EJS, Pug, Handlebars, etc.)
│   ├── layouts/
│   ├── partials/
│   └── <domain>/
└── public/                         # Static assets
    ├── css/
    ├── js/
    └── images/
```

The HTTP adapter in this profile resolves `view` and `redirectTo` fields from `IHttpResponse` and calls the framework's render/redirect APIs. Controllers remain unaware of the rendering engine.

---

### Profile: `spa` — Repository Root Structure

```
/
├── server/                         # JSON API — pure adapter layer over the core
│   └── src/                        # Identical to the src/ tree above
│
└── client/                         # External client (React, Vue, etc.)
    └── src/
        ├── pages/
        ├── components/
        ├── hooks/
        ├── services/               # HTTP client wrappers
        └── contexts/               # Auth state, session
```

The `server/` side is a pure JSON API. It never renders HTML. The `client/` is fully decoupled — it has no knowledge of the server's module structure.

---

### Module Isolation Rules

1. A module never imports from another module's folder.
2. Cross-module data flows only through `shared/contracts/` types and the event bus.
3. If two modules share an entity shape, extract a shared DTO into `src/shared/`.
4. `domain/` and `application/` never import from `infra/` — not even `src/infra/`.
5. The DI container (`src/infra/container/container.ts`) is the **only** file allowed to import concrete implementations and wire them to their interfaces. It is never imported inside domain or application.
6. Logger, hasher, token generator — all are contracts in `shared/`. The core receives implementations via constructor injection, never by importing them directly.

---

## Part II — Shared Contracts (Micro)

Every interface below lives in `src/shared/`. They are the stable core of the system. Infra adapters implement them; the domain and application layers depend only on them.

---

### HTTP Layer

#### `IHttpRequest`

```typescript
// src/shared/contracts/http/IHttpRequest.ts

export interface IHttpRequest<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>
> {
  body: TBody
  params: TParams
  query: TQuery
  headers: Record<string, string | string[] | undefined>
  userId?: string           // populated by auth middleware after strategy validation
  session?: Record<string, unknown>  // [view-engine] populated from framework session
}
```

#### `IHttpResponse`

```typescript
// src/shared/contracts/http/IHttpResponse.ts

export interface IHttpResponse<TData = unknown> {
  statusCode: number
  body: {
    data?: TData
    message?: string
    error?: string
  }
  // [view-engine only] — omit in spa profile
  view?: string             // template path relative to views/
  redirectTo?: string
}
```

#### `IController`

Controllers are framework-agnostic. They receive `IHttpRequest` and return `IHttpResponse`. No Express, Fastify, Koa, or any other framework type appears here.

```typescript
// src/shared/contracts/http/IController.ts

import type { IHttpRequest } from './IHttpRequest'
import type { IHttpResponse } from './IHttpResponse'

export interface IController<TBody = unknown, TData = unknown> {
  handle(request: IHttpRequest<TBody>): Promise<IHttpResponse<TData>>
}
```

The HTTP framework adapter (in `src/infra/http/adapter.ts`) is the **only** place that translates between `IController` and the chosen framework. Swapping Express for Fastify means rewriting the adapter only.

```typescript
// src/infra/http/adapter.ts — example for a generic framework-agnostic pattern
// Each framework gets its own adapter implementation here.

// spa profile adapter (JSON only):
export function adaptRoute(controller: IController) {
  return async (req: FrameworkRequest, res: FrameworkResponse) => {
    const httpRequest: IHttpRequest = {
      body: req.body,
      params: req.params as Record<string, string>,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      userId: req.userId,
    }
    const { statusCode, body } = await controller.handle(httpRequest)
    res.status(statusCode).json(body)
  }
}

// view-engine profile adapter (render / redirect / json):
export function adaptRoute(controller: IController) {
  return async (req: FrameworkRequest, res: FrameworkResponse) => {
    const httpRequest: IHttpRequest = {
      body: req.body,
      params: req.params as Record<string, string>,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      userId: req.userId,
      session: req.session,
    }
    const response = await controller.handle(httpRequest)
    if (response.redirectTo) return res.redirect(response.redirectTo)
    if (response.view) return res.status(response.statusCode).render(response.view, response.body.data)
    res.status(response.statusCode).json(response.body)
  }
}
```

---

### Auth Layer

#### `IAuthStrategy`

Framework-agnostic. Uses `IHttpRequest` as input so the strategy never touches the framework's request object directly.

```typescript
// src/shared/contracts/auth/IAuthStrategy.ts

import type { IHttpRequest } from '../http/IHttpRequest'

export interface IAuthPayload {
  userId: string
  roles?: string[]
}

export interface IAuthStrategy {
  /**
   * Reads the request and returns the authenticated payload, or null if unauthenticated.
   */
  validate(request: IHttpRequest): Promise<IAuthPayload | null>

  /**
   * Writes credentials to the response (cookie, token in body, etc.).
   * The `res` parameter is typed as `unknown` — each implementation casts it to
   * the framework response type it knows about. The core never calls this.
   */
  attach(res: unknown, payload: IAuthPayload): Promise<void>

  /**
   * Clears credentials (logout).
   */
  revoke(res: unknown): Promise<void>
}
```

Concrete implementations live in `src/infra/auth/` and are the only files allowed to import framework-specific session or token libraries.

```typescript
// src/infra/auth/TokenAuthStrategy.ts  [spa profile]
// Framework-agnostic: uses any token library (jsonwebtoken, jose, etc.)

import { IAuthStrategy, IAuthPayload } from '../../shared/contracts/auth/IAuthStrategy'
import { IHttpRequest } from '../../shared/contracts/http/IHttpRequest'

export class TokenAuthStrategy implements IAuthStrategy {
  constructor(private readonly tokenService: ITokenService) {}  // ITokenService is also a shared/ contract

  async validate(request: IHttpRequest): Promise<IAuthPayload | null> {
    const authHeader = request.headers['authorization']
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) return null
    return this.tokenService.verify(String(authHeader).split(' ')[1])
  }

  async attach(res: unknown, payload: IAuthPayload): Promise<void> {
    (res as any).json({ token: await this.tokenService.sign(payload) })
  }

  async revoke(_res: unknown): Promise<void> {
    // stateless — client discards token
  }
}
```

```typescript
// src/infra/auth/CookieAuthStrategy.ts  [view-engine profile]
// Framework-agnostic: reads from session, writes via set-cookie

import { IAuthStrategy, IAuthPayload } from '../../shared/contracts/auth/IAuthStrategy'
import { IHttpRequest } from '../../shared/contracts/http/IHttpRequest'

export class CookieAuthStrategy implements IAuthStrategy {
  async validate(request: IHttpRequest): Promise<IAuthPayload | null> {
    const userId = request.session?.userId
    if (!userId) return null
    return { userId: userId as string }
  }

  async attach(res: unknown, payload: IAuthPayload): Promise<void> {
    (res as any).cookie('session', payload.userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })
  }

  async revoke(res: unknown): Promise<void> {
    (res as any).clearCookie('session')
  }
}
```

**Auth middleware — framework-agnostic by delegation:**

```typescript
// src/infra/http/middlewares/auth.middleware.ts
// Only this file knows about the framework's req/res types.

import { IAuthStrategy } from '../../../shared/contracts/auth/IAuthStrategy'

export function makeAuthMiddleware(strategy: IAuthStrategy) {
  return async (req: any, res: any, next: any) => {
    const payload = await strategy.validate({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
      session: req.session,
    })
    if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    req.userId = payload.userId
    next()
  }
}
```

**Strategy injection point — `src/infra/http/app.ts`:**

```typescript
// Swap the concrete class to change auth mechanism — zero changes elsewhere
import { CookieAuthStrategy } from '../auth/CookieAuthStrategy'  // [view-engine]
// import { TokenAuthStrategy } from '../auth/TokenAuthStrategy'  // [spa]

const authStrategy = new CookieAuthStrategy()
app.use('/protected', makeAuthMiddleware(authStrategy))
```

---

### Repository Layer

#### `IRepository`

Minimum viable contract. No assumptions about query language, table structure, or driver. Domain-specific repositories extend this with their own query methods — still in the form of domain-meaningful operations, not SQL/NoSQL primitives.

```typescript
// src/shared/contracts/repository/IRepository.ts

export interface IRepository<T, TId = string> {
  findById(id: TId): Promise<T | null>
  save(entity: T): Promise<void>
  delete(id: TId): Promise<void>
}
```

**Domain-specific extension** (lives inside the module — not in `shared/`):

```typescript
// src/modules/users/infra/repositories/IUserRepository.ts

import type { IRepository } from '../../../../shared/contracts/repository/IRepository'
import type { User } from '../../domain/entities/User'

// Domain-meaningful query methods only — no SQL, no filter objects, no ORMs
export interface IUserRepository extends IRepository<User> {
  findByEmail(email: string): Promise<User | null>
}
```

**Concrete implementations** — one per persistence driver, always in `infra/`:

```typescript
// src/modules/users/infra/repositories/KnexUserRepository.ts
// src/modules/users/infra/repositories/MongooseUserRepository.ts
// Both implement IUserRepository. The DI container chooses which one to wire.
```

**In-memory fake** (for unit tests — never in production code):

```typescript
// src/modules/users/tests/fakes/InMemoryUserRepository.ts

import type { IUserRepository } from '../../infra/repositories/IUserRepository'
import type { User } from '../../domain/entities/User'

export class InMemoryUserRepository implements IUserRepository {
  private items: User[] = []

  async findById(id: string): Promise<User | null> {
    return this.items.find(u => u.id === id) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.items.find(u => u.email === email) ?? null
  }

  async save(entity: User): Promise<void> {
    const index = this.items.findIndex(u => u.id === entity.id)
    if (index >= 0) this.items[index] = entity
    else this.items.push(entity)
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter(u => u.id !== id)
  }
}
```

---

### Use Case Layer

#### `IUseCase`

```typescript
// src/shared/contracts/usecase/IUseCase.ts

import type { Result } from '../../result/Result'

export interface IUseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput>>
}
```

#### `Result<T>` — lightweight Either monad

```typescript
// src/shared/result/Result.ts

export class Result<T> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly error?: string,
    private readonly _value?: T
  ) {}

  get value(): T {
    if (!this.isSuccess) throw new Error('Cannot access value of a failed Result')
    return this._value as T
  }

  static ok<T>(value?: T): Result<T> {
    return new Result<T>(true, undefined, value)
  }

  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, error)
  }
}
```

---

### Logger Contract

The core may log — but it must not depend on Pino, Winston, or any library.

```typescript
// src/shared/logger/ILogger.ts

export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
}
```

The concrete implementation (e.g. `PinoLogger`) lives in `src/infra/logger/` and is injected via the DI container. Use cases that need logging receive `ILogger` in their constructor.

---

### DI Container Contract

The container itself is an abstraction. The core knows it can ask for something by token — it does not know what library is resolving it.

```typescript
// src/shared/contracts/container/IContainer.ts

export interface IContainer {
  resolve<T>(token: string | symbol): T
}
```

The concrete implementation (Awilix, tsyringe, InversifyJS, or a hand-rolled registry) lives in `src/infra/container/container.ts`. This is the **only file in the entire codebase** allowed to import every concrete class simultaneously — it is the composition root.

```typescript
// src/infra/container/container.ts  — composition root (Awilix example)
// Pattern is the same for any DI library; only the API calls change.

import { createContainer, asClass, asValue } from 'awilix'
import { KnexUserRepository } from '../../modules/users/infra/repositories/KnexUserRepository'
import { CreateUserUseCase } from '../../modules/users/application/use-cases/CreateUserUseCase'
import { PinoLogger } from '../logger/PinoLogger'

const container = createContainer()

container.register({
  logger:         asValue(new PinoLogger()),
  userRepository: asClass(KnexUserRepository).singleton(),
  createUser:     asClass(CreateUserUseCase).transient(),
})

export { container }
```

> **Rule:** No file outside `src/infra/container/` imports from `container.ts`. Controllers and use cases receive their dependencies through constructor parameters — they never call `container.resolve()` themselves.

---

### Events Layer

#### `IDomainEvent`

```typescript
// src/shared/contracts/events/IDomainEvent.ts

export interface IDomainEvent {
  readonly eventName: string       // e.g. 'user.created', 'appointment.cancelled'
  readonly occurredAt: Date
  readonly aggregateId: string
}
```

#### `IEventHandler`

```typescript
// src/shared/contracts/events/IEventHandler.ts

import type { IDomainEvent } from './IDomainEvent'

export interface IEventHandler<TEvent extends IDomainEvent = IDomainEvent> {
  handle(event: TEvent): Promise<void>
}
```

**EventBus** — uses Node's built-in `EventEmitter` as a default implementation. Can be swapped for a message broker adapter without touching any handler.

```typescript
// src/infra/events/EventBus.ts

import EventEmitter from 'node:events'
import type { IDomainEvent } from '../../shared/contracts/events/IDomainEvent'
import type { IEventHandler } from '../../shared/contracts/events/IEventHandler'

class EventBus {
  private emitter = new EventEmitter()

  subscribe<TEvent extends IDomainEvent>(
    eventName: string,
    handler: IEventHandler<TEvent>
  ): void {
    this.emitter.on(eventName, (event: TEvent) => handler.handle(event))
  }

  publish(event: IDomainEvent): void {
    this.emitter.emit(event.eventName, event)
  }
}

export const eventBus = new EventBus()
```

---

### Error Contracts

```typescript
// src/shared/errors/AppError.ts
// Signals recoverable, expected failures at the boundary layer (HTTP, CLI, etc.)

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

```typescript
// src/shared/errors/DomainError.ts
// Signals business rule violations — no HTTP coupling, no status code

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
```

**Convention:**
- Domain and use-case layers return `Result.fail('reason')` — they never throw.
- Controllers map a failed `Result` to the appropriate `IHttpResponse` status code.
- Unexpected infrastructure failures (DB unreachable, etc.) throw `AppError`, caught by the framework error middleware.

---

## Part III — Naming Conventions

| Artifact | Pattern | Example |
|---|---|---|
| Entity | `PascalCase` | `User`, `Appointment` |
| Value Object | `PascalCase` | `Email`, `PhoneNumber` |
| Use Case | `VerbNounUseCase` | `CreateUserUseCase` |
| Controller | `VerbNounController` | `CreateUserController` |
| Repository contract | `I<Entity>Repository` | `IUserRepository` |
| Repository impl | `<Driver><Entity>Repository` | `KnexUserRepository`, `MongooseUserRepository` |
| Auth strategy impl | `<Mechanism>AuthStrategy` | `CookieAuthStrategy`, `TokenAuthStrategy` |
| DTO (input) | `<UseCase>DTO` | `CreateUserDTO` |
| Domain Event | `<Entity><PastVerb>Event` | `UserCreatedEvent` |
| Event Handler | `On<EntityPastVerb>` | `OnUserCreated` |
| Logger impl | `<Library>Logger` | `PinoLogger`, `WinstonLogger` |
| In-memory fake | `InMemory<Entity>Repository` | `InMemoryUserRepository` |
| Route file | `<domain>.routes.ts` | `users.routes.ts` |
| View template | `<domain>/<action>.{ext}` | `users/login.ejs` |
| Test — unit | `<Subject>.spec.ts` | `CreateUserUseCase.spec.ts` |
| Test — integration | `<Subject>.test.ts` | `users.routes.test.ts` |

---

## Part IV — Testing Conventions

### Unit Tests (Vitest)
- Location: `src/modules/<domain>/tests/unit/`
- Test domain entities and use cases in pure isolation
- Dependencies injected as in-memory fakes from `tests/fakes/` — never real DB, never HTTP, never framework code
- Auth context faked by passing a pre-populated `userId` in the `IHttpRequest` stub
- File suffix: `.spec.ts`

```typescript
// Pattern: use-case unit test
import { describe, it, expect, beforeEach } from 'vitest'
import { CreateUserUseCase } from '../../application/use-cases/CreateUserUseCase'
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository'

describe('CreateUserUseCase', () => {
  let sut: CreateUserUseCase
  let userRepository: InMemoryUserRepository

  beforeEach(() => {
    userRepository = new InMemoryUserRepository()
    sut = new CreateUserUseCase(userRepository)
  })

  it('should create a user with a hashed password', async () => {
    const result = await sut.execute({ email: 'test@test.com', password: 'secret123' })
    expect(result.isSuccess).toBe(true)
  })

  it('should fail if email is already taken', async () => {
    await sut.execute({ email: 'test@test.com', password: 'secret123' })
    const result = await sut.execute({ email: 'test@test.com', password: 'other' })
    expect(result.isSuccess).toBe(false)
  })
})
```

### Integration Tests (Vitest + Supertest)
- Location: `src/modules/<domain>/tests/integration/`
- Test the full HTTP stack: route → adapter → controller → use case → real persistence adapter
- Use a dedicated test database; run migrations before suite, roll back after
- Inject auth credentials (test token or session cookie) in request headers
- File suffix: `.test.ts`

---

## Part V — Tooling Contracts

### Commit Convention (Commitizen)
Format: `<type>(<scope>): <description>`

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | No behavior change |
| `test` | Adding or fixing tests |
| `chore` | Tooling, deps, config |
| `docs` | Documentation only |

Scope = module name or `shared`. Example: `feat(users): add email verification use case`

### Pre-commit Pipeline (Husky + lint-staged)
Runs on staged files only:
1. ESLint (auto-fix)
2. Prettier (format)
3. TypeScript type-check (`tsc --noEmit`)

Unit tests run in CI — not in the pre-commit hook (keep it fast).

---

## Quick Reference — Where Does X Live?

| What you're building | Where it goes |
|---|---|
| HTTP request/response contracts | `src/shared/contracts/http/` |
| Use case base contract | `src/shared/contracts/usecase/IUseCase.ts` |
| Base repository contract | `src/shared/contracts/repository/IRepository.ts` |
| Auth strategy contract | `src/shared/contracts/auth/IAuthStrategy.ts` |
| DI container contract | `src/shared/contracts/container/IContainer.ts` |
| Logger contract | `src/shared/logger/ILogger.ts` |
| Domain event contracts | `src/shared/contracts/events/` |
| Error types | `src/shared/errors/` |
| Result monad | `src/shared/result/Result.ts` |
| New domain entity or value object | `src/modules/<domain>/domain/` |
| New use case | `src/modules/<domain>/application/use-cases/` |
| Input DTO | `src/modules/<domain>/application/dtos/` |
| New controller | `src/modules/<domain>/infra/http/controllers/` |
| Module-specific repository contract | `src/modules/<domain>/infra/repositories/I<Entity>Repository.ts` |
| Persistence adapter (any driver) | `src/modules/<domain>/infra/repositories/<Driver><Entity>Repository.ts` |
| In-memory fake | `src/modules/<domain>/tests/fakes/` |
| Auth strategy implementation | `src/infra/auth/` |
| Logger implementation | `src/infra/logger/` |
| HTTP framework adapter | `src/infra/http/adapter.ts` |
| Auth middleware | `src/infra/http/middlewares/auth.middleware.ts` |
| Composition root (DI wiring) | `src/infra/container/container.ts` |
| DB migrations | `src/infra/persistence/migrations/` |
| Event bus | `src/infra/events/EventBus.ts` |
| View templates | `src/infra/http/views/` `[view-engine]` |
| Static assets | `src/infra/http/public/` `[view-engine]` |
| React/Vue client | `client/src/` `[spa]` |
| Unit test | `src/modules/<domain>/tests/unit/` |
| Integration test | `src/modules/<domain>/tests/integration/` |
