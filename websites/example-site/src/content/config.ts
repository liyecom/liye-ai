import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.string(),
    keywords: z.array(z.string()),
    affiliateProducts: z.array(z.string()).optional(),
    ctaText: z.string().optional(),
    intent: z.enum(['informational', 'commercial', 'transactional']),
    source: z.string().optional(),
    source_url: z.string().optional(),
  }),
});

export const collections = {
  'posts': postsCollection,
};
