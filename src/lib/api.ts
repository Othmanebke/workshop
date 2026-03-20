/**
 * api.ts — Couche d'accès aux données
 *
 * Ce fichier centralise toutes les requêtes vers Strapi.
 * Il expose deux approches :
 *   - REST  : simple, lisible, idéal pour les requêtes basiques
 *   - GraphQL : flexible, permet de demander exactement les champs voulus
 *
 * Utilisation dans les pages Astro :
 *   import { fetchArticlesREST, fetchArticlesGraphQL } from '../lib/api';
 */

const STRAPI_URL = import.meta.env.PUBLIC_STRAPI_URL ?? 'http://127.0.0.1:1337';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/** Requête REST générique */
async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${STRAPI_URL}/api${path}`);
  if (!res.ok) throw new Error(`REST ${path} → ${res.status}`);
  const json = await res.json();
  return json.data as T;
}

/** Requête GraphQL générique */
async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRAPI_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL → ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

// ─────────────────────────────────────────
// Types partagés
// ─────────────────────────────────────────

export interface ArticleSummary {
  Titre: string;
  Slug: string;
  publishedAt: string;
  categorie?: { Nom: string; slug: string };
}

export interface ArticleFull extends ArticleSummary {
  Contenu: unknown[]; // bloc rich text Strapi
}

export interface Categorie {
  id: number;
  Nom: string;
  slug: string;
}

// ─────────────────────────────────────────
// REST — exemples d'utilisation
// ─────────────────────────────────────────

/** Les N derniers articles (homepage) */
export async function fetchArticlesREST(limit = 5): Promise<ArticleSummary[]> {
  return rest(
    `/articles?sort=createdAt:desc&populate=categorie&pagination[limit]=${limit}`
  );
}

/** Tous les articles (listing) */
export async function fetchAllArticlesREST(): Promise<ArticleSummary[]> {
  return rest(
    `/articles?sort=createdAt:desc&populate=categorie&pagination[pageSize]=100`
  );
}

/** Toutes les catégories */
export async function fetchCategoriesREST(): Promise<Categorie[]> {
  return rest(`/categories`);
}

/** Articles d'une catégorie */
export async function fetchArticlesByCategoryREST(slug: string): Promise<ArticleSummary[]> {
  return rest(
    `/articles?filters[categorie][slug][$eq]=${slug}&populate=categorie&sort=createdAt:desc`
  );
}

// ─────────────────────────────────────────
// GraphQL — mêmes données, autre approche
// ─────────────────────────────────────────

/**
 * Les N derniers articles via GraphQL.
 *
 * Avantage vs REST : on demande exactement les champs nécessaires.
 * Pas de sur-fetch (over-fetching) ni de sous-fetch (under-fetching).
 */
export async function fetchArticlesGraphQL(limit = 5): Promise<ArticleSummary[]> {
  const data = await graphql<{ articles: ArticleSummary[] }>(`
    query DerniersArticles($limit: Int) {
      articles(
        sort: "createdAt:desc"
        pagination: { limit: $limit }
      ) {
        Titre
        Slug
        publishedAt
        categorie {
          Nom
          slug
        }
      }
    }
  `, { limit });

  return data.articles;
}

/**
 * Tous les articles via GraphQL (pour le listing).
 */
export async function fetchAllArticlesGraphQL(): Promise<ArticleSummary[]> {
  const data = await graphql<{ articles: ArticleSummary[] }>(`
    query TousLesArticles {
      articles(
        sort: "createdAt:desc"
        pagination: { limit: 100 }
      ) {
        Titre
        Slug
        publishedAt
        categorie {
          Nom
          slug
        }
      }
    }
  `);

  return data.articles;
}

/**
 * Toutes les catégories via GraphQL.
 */
export async function fetchCategoriesGraphQL(): Promise<Categorie[]> {
  const data = await graphql<{ categories: Categorie[] }>(`
    query Categories {
      categories(sort: "Nom:asc") {
        Nom
        slug
      }
    }
  `);

  return data.categories;
}

/**
 * Articles filtrés par catégorie via GraphQL.
 * Montre la puissance des variables GraphQL.
 */
export async function fetchArticlesByCategoryGraphQL(slug: string): Promise<ArticleSummary[]> {
  const data = await graphql<{ articles: ArticleSummary[] }>(`
    query ArticlesParCategorie($slug: String!) {
      articles(
        filters: { categorie: { slug: { eq: $slug } } }
        sort: "createdAt:desc"
      ) {
        Titre
        Slug
        publishedAt
        categorie {
          Nom
          slug
        }
      }
    }
  `, { slug });

  return data.articles;
}
