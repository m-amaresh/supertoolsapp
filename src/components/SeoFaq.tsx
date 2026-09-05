import { cn } from "@/lib/utils";

export interface SeoFaqItem {
  question: string;
  answer: string;
}

interface SeoFaqProps {
  title: string;
  about?: string;
  howToUse?: string[];
  items: SeoFaqItem[];
  className?: string;
}

// Renders an about section, how-to steps, and FAQ items as visible content,
// injecting JSON-LD schemas (FAQPage + HowTo) for search engine rich results.
export function SeoFaq({
  title,
  about,
  howToUse,
  items,
  className,
}: SeoFaqProps) {
  const toolName = title.replace(/\s*FAQ$/, "");

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const howToSchema =
    howToUse && howToUse.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: `How to use ${toolName}`,
          step: howToUse.map((text, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            text,
          })),
        }
      : null;

  return (
    <section className={cn("mt-6 space-y-4", className)} aria-label={title}>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      {howToSchema && (
        <script type="application/ld+json">
          {JSON.stringify(howToSchema)}
        </script>
      )}

      {about && (
        <div className="glass-panel rounded-xl border border-border p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            About {toolName}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {about}
          </p>
        </div>
      )}

      {howToUse && howToUse.length > 0 && (
        <div className="glass-panel rounded-xl border border-border p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            How to Use {toolName}
          </h2>
          <ol className="mt-2 list-inside list-decimal space-y-1.5 text-[14px] leading-relaxed text-muted-foreground">
            {howToUse.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static ordered list, never reordered
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="glass-panel rounded-xl border border-border p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.question}>
              <h3 className="text-[14px] font-medium text-foreground">
                {item.question}
              </h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
