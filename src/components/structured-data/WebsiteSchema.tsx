import React from 'react';

/**
 * JSON‑LD structured data for the website. This provides Google with
 * information about the site name, URL and potential search actions.
 */
const WebsiteSchema = () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Okazje+',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl'}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
};

export default WebsiteSchema;
