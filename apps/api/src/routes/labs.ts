import type { FastifyPluginAsync } from 'fastify';
import { prisma, RedisCacheService } from '@faultforge/database';

export const labRoutes: FastifyPluginAsync = async (app) => {
  /**
   * List all lab catalogs with scenario counts
   */
  app.get(
    '/',
    {
      schema: {
        description: 'List all registered lab environments',
        tags: ['Labs'],
      },
    },
    async (_request, reply) => {
      const labs = await RedisCacheService.getOrSet(
        'labs:list',
        async () => {
          return await prisma.labDefinition.findMany({
            include: {
              scenarios: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  category: true,
                  difficulty: true,
                  description: true,
                },
              },
            },
          });
        },
        { ttlSeconds: 120 },
      );

      return reply.send({ items: labs });
    },
  );

  /**
   * Get specific scenario details
   */
  app.get(
    '/scenarios/:code',
    {
      schema: {
        description: 'Get details of a specific scenario by unique code',
        tags: ['Labs'],
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };

      const scenario = await prisma.scenarioDefinition.findUnique({
        where: { code },
        include: {
          lab: true,
        },
      });

      if (!scenario) {
        return reply.status(404).send({
          type: 'https://faultforge.ai/errors/not-found',
          title: 'Scenario Not Found',
          status: 404,
          detail: `Scenario with code '${code}' does not exist.`,
        });
      }

      return reply.send(scenario);
    },
  );
};
