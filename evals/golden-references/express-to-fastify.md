# Golden Reference Version: 1.0
# Created: 2026-02-07
# Last Validated: 2026-02-07
# Expires: 2026-08-07

# Research: Migrating Express.js to Fastify

**Task ID:** eval-golden-005
**Date:** 2026-02-07
**Domain:** Node.js framework migration
**Overall Confidence:** HIGH

## TL;DR

Use **incremental migration** via `@fastify/express` compatibility layer. This lets you run Express middleware and routes inside Fastify, migrating route-by-route without a big-bang rewrite. Start with new routes in Fastify, gradually convert existing routes, and remove the compatibility layer once migration is complete. Expect 2-3x throughput improvement when fully migrated.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| fastify | 5.x | Target framework | HIGH |
| @fastify/express | latest | Express compatibility layer for incremental migration | HIGH |
| @fastify/websocket | latest | WebSocket support (replaces ws/socket.io) | HIGH |
| @fastify/cors | latest | CORS middleware (replaces cors package) | HIGH |
| @fastify/helmet | latest | Security headers (replaces helmet) | HIGH |

**Install:**
```bash
npm install fastify @fastify/express @fastify/websocket @fastify/cors @fastify/helmet
```

## Key Patterns

### Incremental Migration Setup
**Use when:** Starting the migration — run Express inside Fastify

```typescript
import Fastify from 'fastify';
import expressPlugin from '@fastify/express';
import { expressApp } from './legacy-express-app';

const fastify = Fastify({ logger: true });

await fastify.register(expressPlugin);

// Mount entire Express app under Fastify
fastify.use(expressApp);

// New routes go directly on Fastify
fastify.get('/api/v2/health', async () => {
  return { status: 'ok', framework: 'fastify' };
});

await fastify.listen({ port: 3000 });
```

### Route-by-Route Conversion
**Use when:** Converting individual Express routes to Fastify

```typescript
// Express (before)
app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// Fastify (after)
fastify.get('/api/users/:id', {
  schema: {
    params: { type: 'object', properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { name: { type: 'string' } } } },
  },
}, async (request, reply) => {
  const user = await User.findById(request.params.id);
  if (!user) return reply.status(404).send({ error: 'Not found' });
  return user;
});
```

### Middleware to Plugin Conversion
**Use when:** Converting Express middleware to Fastify hooks/plugins

```typescript
// Express middleware (before)
app.use(cors({ origin: '*' }));
app.use(helmet());
app.use(morgan('combined'));

// Fastify plugins (after)
await fastify.register(import('@fastify/cors'), { origin: '*' });
await fastify.register(import('@fastify/helmet'));
fastify.addHook('onRequest', async (request) => {
  request.log.info({ url: request.url, method: request.method }, 'incoming request');
});
```

### Auth Middleware Migration
**Use when:** Converting Express auth middleware to Fastify

```typescript
// Express (before)
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  req.user = verifyToken(token);
  next();
}

// Fastify (after) — use decorators + hooks
fastify.decorateRequest('user', null);
fastify.addHook('onRequest', async (request, reply) => {
  if (request.routeOptions.config.auth === false) return;
  const token = request.headers.authorization?.split(' ')[1];
  if (!token) return reply.status(401).send({ error: 'Unauthorized' });
  request.user = verifyToken(token);
});
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Express-Fastify bridge | `@fastify/express` | Handles middleware compat, tested with Express 4.x |
| JSON schema validation | Fastify's built-in schema validation (Ajv) | 2-3x faster than joi/yup, auto-generates documentation |
| WebSocket migration | `@fastify/websocket` | Built on ws, integrates with Fastify lifecycle |
| Request logging | Fastify's built-in pino logger | Structured JSON logging, 5x faster than morgan |

## Pitfalls

### Express Middleware Order Matters Differently
**What happens:** Express processes middleware in registration order. Fastify uses a plugin encapsulation model where scope matters more than order. Auth middleware registered in a plugin scope doesn't apply to routes outside that scope.
**Avoid by:** Understand Fastify's encapsulation model. Use `fastify-plugin` to break encapsulation when you need global middleware.

### `res.send()` vs `return` Semantics
**What happens:** Express handlers use `res.send()`/`res.json()` — forgetting to `return` after sending causes "headers already sent" errors. Fastify handlers return values directly, and forgetting to return means empty responses.
**Avoid by:** Use `async` handlers in Fastify and `return` the response body. Avoid mixing `reply.send()` with return values.

### Mongoose Connection Lifecycle
**What happens:** Express apps often connect to MongoDB at startup and share the connection. Fastify's plugin system encourages registering the connection as a decorator, but doing this wrong creates race conditions.
**Avoid by:** Register Mongoose connection in a Fastify plugin with `fastify.decorate('mongoose', connection)`. Use `fastify.addHook('onClose')` for graceful disconnect.

### Breaking Changes in Error Handling
**What happens:** Express error handlers use `(err, req, res, next)` four-argument convention. Fastify uses `setErrorHandler()` with different semantics. Uncaught errors behave differently.
**Avoid by:** Set up `fastify.setErrorHandler()` early in migration. Test error paths explicitly — they're the most common source of migration bugs.

### WebSocket Path Conflicts
**What happens:** Express WebSocket libraries (ws, socket.io) bind directly to the HTTP server. When running Express inside Fastify via `@fastify/express`, both frameworks try to handle upgrade requests, causing connection failures.
**Avoid by:** Migrate WebSocket routes to `@fastify/websocket` early. Don't run both ws libraries simultaneously on the same path.

## Rollback Strategy

1. Keep the Express app intact throughout migration (don't delete Express code until fully migrated)
2. Use feature flags to route traffic between Express and Fastify paths
3. Run both in parallel behind a load balancer during validation
4. Monitor error rates and latency per-route during migration
5. If rollback needed: disable Fastify routes, revert to Express-only mode

## Open Questions

None.

## Sources

**HIGH confidence:**
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [@fastify/express Plugin](https://github.com/fastify/fastify-express)
- [Fastify Migration from Express](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/)

**MEDIUM confidence:**
- [Fastify vs Express Benchmarks](https://fastify.dev/benchmarks/)
- [Fastify Plugin System Guide](https://fastify.dev/docs/latest/Reference/Plugins/)
