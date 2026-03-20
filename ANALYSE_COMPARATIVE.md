# Analyse comparative — Astro × Strapi
## Workshop Frontend × Headless CMS

---

## 1. Architecture du projet

### Astro — un framework "content-first"

Astro repose sur une idée centrale : **envoyer le moins de JavaScript possible au navigateur**.
Par défaut, chaque page est compilée en HTML statique pur au moment du build.
Le JavaScript n'est ajouté que là où c'est explicitement demandé (les "Islands").

Ce projet utilise le mode **static** avec opt-in SSR (`export const prerender = false`),
ce qui signifie :
- Pages statiques (homepage, articles, catégories) → générées à la compilation, ultra-rapides
- Pages dynamiques (login, account) → rendues à la demande côté serveur, nécessitent un adaptateur Node

**Structure des dossiers :**
```
src/
├── components/   → briques réutilisables (ArticleCard, RichText, SearchBar…)
├── layouts/      → Layout.astro — enveloppe HTML partagée
├── lib/          → api.ts — couche d'accès aux données centralisée
└── pages/        → chaque fichier = une route (convention filesystem-based routing)
```

---

## 2. Strapi comme Headless CMS

Strapi est un CMS **découplé** : il gère le contenu mais ne s'occupe pas de l'affichage.
Il expose les données via deux interfaces :

| Interface | Endpoint | Cas d'usage |
|---|---|---|
| REST | `/api/articles` | Requêtes simples, filtres basiques |
| GraphQL | `/graphql` | Requêtes complexes, sélection précise des champs |

### Avantages constatés
- Interface admin intuitive, prise en main rapide
- Génération automatique des types TypeScript (`types/` dans le projet Strapi)
- Système de rôles et permissions granulaire (Public / Authenticated)
- Authentification JWT intégrée sans configuration

### Limites rencontrées
- Les relations entre collections nécessitent `populate` explicite en REST
- La version 5 a supprimé le wrapper `attributes` (breaking change vs v4, documentation parfois en retard)
- Le plugin GraphQL ajoute ~300 packages et nécessite une configuration manuelle du `plugins.ts`

---

## 3. Comparaison REST vs GraphQL

### REST — ce qu'on a utilisé (listing, catégories, recherche)

```
GET /api/articles?sort=createdAt:desc&populate=categorie&pagination[pageSize]=100
```

**Points forts :**
- Simple à lire et déboguer (URL lisible dans le navigateur)
- Mise en cache HTTP native (CDN-friendly)
- Aucune dépendance supplémentaire côté client

**Points faibles :**
- **Over-fetching** : on reçoit tous les champs même si on n'en a besoin que de 2
- Les relations imbriquées complexifient les URLs (`populate[categorie][fields][0]=Nom`)
- Plusieurs ressources = plusieurs requêtes (N+1 problem)

---

### GraphQL — ce qu'on a utilisé (homepage)

```graphql
query DerniersArticles($limit: Int) {
  articles(sort: "createdAt:desc", pagination: { limit: $limit }) {
    Titre
    Slug
    publishedAt
    categorie {
      Nom
      slug
    }
  }
}
```

**Points forts :**
- **Pas d'over-fetching** : on demande exactement ce dont on a besoin
- Une seule requête peut récupérer des données liées (articles + catégories en une fois)
- Le schéma est auto-documenté (introspection dans le playground)
- Les variables typées éliminent les erreurs de concaténation de strings

**Points faibles :**
- Courbe d'apprentissage plus élevée (syntaxe, types, variables)
- Mise en cache HTTP plus complexe (tout passe par POST)
- Le playground ne persiste pas les requêtes entre sessions
- Sur-configuration pour des cas simples

### Verdict
> Pour une application de blog avec des requêtes prévisibles → **REST est suffisant**.
> Dès que les données sont interconnectées ou que le frontend a des besoins très différents selon les pages → **GraphQL apporte une vraie valeur**.

---

## 4. Data Fetching dans Astro

Toutes les requêtes API se font dans le **frontmatter** (`---`), côté serveur, avant le rendu.
Cela signifie :

```astro
---
// Ce code s'exécute sur le serveur — jamais dans le navigateur
const articles = await fetchArticlesGraphQL(5);
---
<!-- Ici on affiche simplement les données -->
```

**Avantage majeur** : zéro waterfall côté client, zéro spinner de chargement.
Les données arrivent directement dans le HTML, ce qui est excellent pour le SEO.

**Comparaison avec d'autres approches :**

| Approche | Rendu | JS envoyé | SEO | Complexité |
|---|---|---|---|---|
| Astro SSG (nos pages statiques) | Build time | ~0 | ⭐⭐⭐ | Faible |
| Astro SSR (nos pages auth) | Request time | ~0 | ⭐⭐⭐ | Moyenne |
| React SPA (useEffect + fetch) | Client side | Tout le bundle | ⭐ | Élevée |
| Next.js (getServerSideProps) | Request time | Bundle React | ⭐⭐⭐ | Moyenne |

---

## 5. Expérience de développement

### Ce qui est plaisant
- **Syntax claire** : le frontmatter sépare logique et template sans ambiguïté
- **Typage TypeScript** natif sans configuration
- **Hot reload** instantané même avec des fetch réseau
- **Scoped styles** par défaut : pas de conflit CSS entre composants
- **Filesystem routing** : créer un fichier = créer une route

### Ce qui est difficile
- Debugger les erreurs de build SSG (les erreurs Strapi font planter `getStaticPaths` sans message clair)
- L'hydratation des Islands nécessite de comprendre la frontière serveur/client
- Passer des données du serveur au script client requiert `define:vars` (ou une alternative)
- La gestion des cookies httpOnly en SSR demande de comprendre le modèle de sécurité

---

## 6. Performances perçues

| Métrique | Résultat |
|---|---|
| First Contentful Paint | Quasi-instantané (HTML pré-généré) |
| JavaScript envoyé | Minimal (uniquement SearchBar + filtres + Header auth) |
| SEO | Meta title, description, Open Graph sur chaque page |
| Images | `loading="lazy"` sur les images du rich text |

Le principal gain d'Astro vs un SPA React : **la page s'affiche sans attendre le JavaScript**.
Sur une connexion lente, la différence est visible immédiatement.

---

## 7. Ce que j'aurais fait différemment

- Utiliser les **Content Collections** d'Astro (système natif avec validation Zod) plutôt que des types TypeScript manuels
- Déployer Strapi sur **Railway** dès le début pour tester le workflow complet en production
- Utiliser **GraphQL uniquement** — l'uniformité aurait simplifié la couche `api.ts`
- Ajouter un système de **tokens de refresh** pour l'authentification (JWT expiré = déconnexion brutale)

---

## 8. Conclusion

Astro et Strapi forment une combinaison solide pour un blog ou un site éditorial.
Astro excelle là où React serait surdimensionné : du contenu statique avec quelques
interactions légères. Strapi offre une expérience CMS complète avec un minimum de
configuration.

Le choix REST vs GraphQL reste contextuel : REST pour la simplicité,
GraphQL pour la flexibilité. Dans ce projet, les deux coexistent dans `src/lib/api.ts`,
ce qui illustre qu'on peut adopter progressivement GraphQL sans tout réécrire.
