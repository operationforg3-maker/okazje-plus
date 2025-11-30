"use client";

import { Component, ErrorInfo, ReactNode } from 'react';
import type { Product } from '@/lib/types';
import ProductCard from '@/components/product-card';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { sanitizeProductRecord } from '@/lib/sanitizers';

interface ProductCardBoundaryProps {
  product: Product;
}

interface ProductCardBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

type FieldDiff = {
  field: string;
  raw: unknown;
  sanitized: unknown;
};

const summarizeProductForLog = (product: Product) => {
  const sanitized = sanitizeProductRecord(product, product.id);
  const diffs: FieldDiff[] = [];
  const rawEntries = product as unknown as Record<string, unknown>;
  const sanitizedEntries = sanitized as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(rawEntries), ...Object.keys(sanitizedEntries)]);

  const isSimpleValue = (value: unknown): boolean => {
    return (
      value === null ||
      ['string', 'number', 'boolean', 'undefined'].includes(typeof value)
    );
  };

  keys.forEach((key) => {
    const rawValue = rawEntries[key];
    const sanitizedValue = sanitizedEntries[key];

    if (isSimpleValue(rawValue) && isSimpleValue(sanitizedValue)) {
      if (!Object.is(rawValue, sanitizedValue)) {
        diffs.push({ field: key, raw: rawValue, sanitized: sanitizedValue });
      }
      return;
    }

    const rawSerialized = JSON.stringify(rawValue ?? null);
    const sanitizedSerialized = JSON.stringify(sanitizedValue ?? null);
    if (rawSerialized !== sanitizedSerialized) {
      diffs.push({ field: key, raw: rawValue, sanitized: sanitizedValue });
    }
  });

  return {
    sanitized,
    fieldDiffs: diffs.slice(0, 12),
  };
};

export class ProductCardBoundary extends Component<
  ProductCardBoundaryProps,
  ProductCardBoundaryState
> {
  state: ProductCardBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ProductCardBoundaryState {
    return { hasError: true, errorMessage: error?.message?.slice(0, 120) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const summary = summarizeProductForLog(this.props.product);
    console.error('ProductCard render error', {
      productId: this.props.product.id,
      error: error?.message,
      stack: info?.componentStack,
      productSnapshot: {
        id: this.props.product.id,
        name: this.props.product.name,
        ratingSources: this.props.product.ratingSources,
        metadata: this.props.product.metadata,
      },
      sanitizedSnapshot: summary.sanitized,
      sanitizedDiffs: summary.fieldDiffs,
    });
  }

  componentDidUpdate(prevProps: ProductCardBoundaryProps) {
    if (prevProps.product.id !== this.props.product.id && this.state.hasError) {
      // Reset boundary state when card receives new product
      this.setState({ hasError: false, errorMessage: undefined });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Problem z kartą produktu
          </div>
          <p className="mb-4 text-muted-foreground">
            Nie udało się wyświetlić danych produktu #{this.props.product.id}. Zgłoszono do logów – kliknij, aby zobaczyć szczegóły na osobnej stronie.
          </p>
          <Link
            href={`/products/${this.props.product.id}`}
            className="mt-auto inline-flex items-center justify-center rounded-md border border-destructive/50 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
          >
            Otwórz stronę produktu
          </Link>
          {this.state.errorMessage && (
            <p className="mt-2 text-[11px] text-muted-foreground">{this.state.errorMessage}</p>
          )}
        </div>
      );
    }

    return <ProductCard product={this.props.product} />;
  }
}
