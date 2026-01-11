/**
 * Product Hunt Data Source
 * Uses GraphQL API to fetch trending products
 */

import type { RawItem, Env } from "../types";
import { getConfig } from "../config";

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
}

interface PHGraphQLResponse {
  data: {
    posts: {
      edges: Array<{
        node: PHPost;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

const TRENDING_QUERY = `
  query GetTrendingPosts($first: Int!) {
    posts(first: $first, order: RANKING) {
      edges {
        node {
          id
          name
          tagline
          url
          votesCount
          commentsCount
          createdAt
        }
      }
    }
  }
`;

/**
 * Fetch trending products from Product Hunt
 */
export async function fetchProductHunt(env: Env): Promise<RawItem[]> {
  const config = getConfig(env);

  const response = await fetch(config.ph.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.PH_ACCESS_TOKEN}`,
      "User-Agent": "Information-OS/0.1 (LiYe OS)",
    },
    body: JSON.stringify({
      query: TRENDING_QUERY,
      variables: { first: config.ph.maxItems },
    }),
  });

  if (!response.ok) {
    throw new Error(`PH API fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as PHGraphQLResponse;

  if (result.errors && result.errors.length > 0) {
    throw new Error(`PH API error: ${result.errors[0].message}`);
  }

  const posts = result.data?.posts?.edges || [];

  return posts.map(({ node }) => ({
    id: `ph_${node.id}`,
    title: `${node.name}: ${node.tagline}`,
    link: node.url,
    source: "product_hunt" as const,
    points: node.votesCount,
    comments: node.commentsCount,
    pubDate: node.createdAt,
  }));
}
