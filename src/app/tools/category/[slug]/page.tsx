import { faChevronRight } from "@fortawesome/free-solid-svg-icons/faChevronRight";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteUrl } from "@/lib/site";
import { categoryBySlug, toolCategories, toolsInCategory } from "@/lib/tools";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return toolCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) return {};

  const path = `/tools/category/${category.slug}`;
  const title = `${category.heading} | SuperTools`;

  return {
    title,
    description: category.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title,
      description: category.description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "SuperTools - Privacy-first browser developer tools",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: category.description,
      images: ["/twitter-image"],
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const siteUrl = getSiteUrl();
  const path = `/tools/category/${category.slug}`;
  const tools = toolsInCategory(category.name);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: category.heading,
        item: `${siteUrl}${path}`,
      },
    ],
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.heading,
    description: category.description,
    url: `${siteUrl}${path}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: tools.map((tool, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: tool.name,
        url: `${siteUrl}${tool.href}`,
      })),
    },
  };

  return (
    <div className="p-1 lg:p-2">
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(collectionSchema)}
      </script>

      <div className="mx-auto w-full max-w-[1500px]">
        <nav aria-label="Breadcrumb" className="mb-3 px-1">
          <ol className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-foreground"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <FontAwesomeIcon icon={faChevronRight} className="h-2 w-2" />
            </li>
            <li className="font-medium text-foreground" aria-current="page">
              {category.heading}
            </li>
          </ol>
        </nav>

        <header className="glass-panel mb-6 rounded-2xl p-5 sm:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
            {category.name}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {category.heading}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {category.description}
          </p>
        </header>

        <section aria-label={`${category.heading} list`}>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="glass-panel group flex min-h-24 items-center justify-between gap-3 rounded-xl p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div>
                  <h2 className="text-[15px] font-medium text-foreground">
                    {tool.name}
                  </h2>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className="h-3 w-3 flex-shrink-0 text-muted-foreground transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>

        <nav aria-label="Other categories" className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Browse other categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {toolCategories
              .filter((c) => c.slug !== category.slug)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/tools/category/${c.slug}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-border bg-background px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {c.heading}
                </Link>
              ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
