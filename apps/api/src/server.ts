import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from '@faultforge/config';
import requestIdPlugin from './plugins/request-id.js';
import authPlugin from './plugins/auth.js';
import { setupErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { labRoutes } from './routes/labs.js';
import { incidentRoutes } from './routes/incidents.js';
import { referenceLibraryRoutes } from './routes/reference-library.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  // 1. Security & Core Middleware Plugins
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [config.WEB_URL, 'http://localhost:5173'],
    credentials: true,
  });
  await app.register(cookie, {
    secret: config.SESSION_SECRET,
    hook: 'onRequest',
  });
  await app.register(requestIdPlugin);
  await app.register(authPlugin);

  // 2. OpenAPI / Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FaultForge AI — Core REST Gateway',
        description:
          'API for controlled fault injection, agentic telemetry investigation, double-blind evaluation arena, and reference solutions.',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
      tags: [
        { name: 'Health', description: 'Liveness & readiness health checks' },
        { name: 'Authentication', description: 'OIDC PKCE authentication & session management' },
        { name: 'Workspaces', description: 'Multi-tenant organization workspaces' },
        {
          name: 'Incidents',
          description: 'Fault injection, telemetry, and investigation lifecycle',
        },
        { name: 'Labs', description: 'Controlled vulnerable lab catalog & scenarios' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // 3. Setup Centralized Error Handling (RFC 7807)
  setupErrorHandler(app);

  // 4. Register Domain API Routes under /api/v1
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
  await app.register(incidentRoutes, { prefix: '/api/v1/workspaces/:workspaceId/incidents' });
  await app.register(labRoutes, { prefix: '/api/v1/labs' });
  await app.register(referenceLibraryRoutes, { prefix: '/api/v1/reference-library' });

  return app;
}
