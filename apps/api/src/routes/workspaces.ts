import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@faultforge/database';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(3).max(50),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
});

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  /**
   * List all workspaces
   */
  app.get(
    '/',
    {
      schema: {
        description: 'List available workspaces',
        tags: ['Workspaces'],
      },
    },
    async (_request, reply) => {
      const workspaces = await prisma.workspace.findMany({
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { memberships: true, incidentRuns: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({ items: workspaces });
    },
  );

  /**
   * Create a new workspace
   */
  app.post(
    '/',
    {
      schema: {
        description: 'Create a new workspace within an organization',
        tags: ['Workspaces'],
      },
    },
    async (request, reply) => {
      const body = createWorkspaceSchema.parse(request.body);

      const workspace = await prisma.workspace.create({
        data: {
          orgId: body.orgId,
          name: body.name,
          slug: body.slug,
        },
      });

      return reply.status(201).send(workspace);
    },
  );
};
