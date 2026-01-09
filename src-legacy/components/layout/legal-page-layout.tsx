import React, { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface LegalSectionLink {
  id: string;
  label: string;
}

interface Breadcrumb {
  label: string;
  href?: string;
}

interface LegalPageLayoutProps {
  title: string;
  description: string;
  updatedAt: string;
  sectionLinks?: LegalSectionLink[];
  autoGenerateSections?: boolean;
  heroIcon?: ReactNode;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: Breadcrumb[];
  children: ReactNode;
}

const headingTagPattern = /^h[1-6]$/;

function collectText(nodes: ReactNode): string {
  let text = "";
  React.Children.forEach(nodes, (child) => {
    if (typeof child === "string") {
      text += child;
      return;
    }
    if (typeof child === "number") {
      text += child.toString();
      return;
    }
    if (React.isValidElement(child)) {
      text += collectText(child.props.children);
    }
  });
  return text.replace(/\s+/g, " ").trim();
}

function findHeadingText(nodes: ReactNode): string | null {
  let found: string | null = null;
  React.Children.forEach(nodes, (child) => {
    if (found) {
      return;
    }
    if (React.isValidElement(child)) {
      if (typeof child.type === "string" && headingTagPattern.test(child.type)) {
        const textContent = collectText(child.props.children);
        if (textContent) {
          found = textContent;
          return;
        }
      }
      const nested = findHeadingText(child.props.children);
      if (nested) {
        found = nested;
      }
    }
  });
  return found;
}

function extractSections(children: ReactNode): LegalSectionLink[] {
  const seen = new Set<string>();
  const sections: LegalSectionLink[] = [];

  const walk = (nodes: ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) {
        return;
      }

      if (typeof child.type === "string" && child.type === "section") {
        const sectionId = child.props?.id;
        if (sectionId && !seen.has(sectionId)) {
          const label = findHeadingText(child.props.children);
          if (label) {
            sections.push({ id: sectionId, label });
            seen.add(sectionId);
          }
        }
      }

      if (child.props?.children) {
        walk(child.props.children);
      }
    });
  };

  walk(children);
  return sections;
}

export function LegalPageLayout({
  title,
  description,
  updatedAt,
  sectionLinks,
  autoGenerateSections,
  heroIcon,
  backHref = "/",
  backLabel = "Powrót do strony głównej",
  breadcrumbs = [{ label: "Strona główna", href: "/" }, { label: title }],
  children,
}: LegalPageLayoutProps) {
  const generatedSections = autoGenerateSections ? extractSections(children) : [];
  const tocSections = sectionLinks && sectionLinks.length > 0 ? sectionLinks : generatedSections;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
      {backHref ? (
        <Button variant="ghost" asChild className="mb-6">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      ) : null}

      <nav className="mb-8 flex items-center gap-2 text-sm text-muted-foreground" aria-label="Okazje+ breadcrumbs">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="transition-colors hover:text-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground" : undefined}>{crumb.label}</span>
              )}
              {!isLast ? <ChevronRight className="h-3.5 w-3.5 opacity-60" /> : null}
            </span>
          );
        })}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:pt-2">
          <Card className="sticky top-28 border border-border/60 bg-card/80 backdrop-blur">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Spis treści
                </p>
                <Separator className="bg-border/60" />
              </div>
              <nav className="space-y-1 text-sm" aria-label="Sekcje dokumentu">
                {tocSections.length ? (
                  tocSections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-lg px-3 py-2 text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      {section.label}
                    </a>
                  ))
                ) : (
                  <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Brak zdefiniowanych sekcji.
                  </p>
                )}
              </nav>
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-8">
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 shadow-sm">
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {heroIcon ? (
                  <div className="hidden rounded-2xl bg-background/80 p-3 text-primary shadow-sm sm:block">
                    {heroIcon}
                  </div>
                ) : null}
                <div className="space-y-3">
                  <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                    Dokument prawny
                  </Badge>
                  <h1 className="font-headline text-3xl font-semibold text-foreground md:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                    {description}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <p className="font-medium text-foreground">Data aktualizacji</p>
                <p>{updatedAt}</p>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_60%)]" />
          </section>

          <section className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-sm md:p-10">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
