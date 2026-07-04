'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function PreviewIndex() {
  const versions = [
    { id: 1, title: 'Version 1', img: '/preview-assets/v1/thumbnail.png' },
    { id: 2, title: 'Version 2', img: '/preview-assets/v2/thumbnail.png' },
    { id: 3, title: 'Version 3', img: '/preview-assets/v3/thumbnail.png' },
    { id: 4, title: 'Version 4', img: '/preview-assets/v4/thumbnail.png' },
    { id: 5, title: 'Version 5', img: '/preview-assets/v5/thumbnail.png' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {versions.map((v) => (
        <Link key={v.id} href={`/admin/preview/v${v.id}`} className="group rounded-xl border p-4 hover:shadow-lg transition-shadow bg-background/60 backdrop-blur-lg">
          <div className="flex flex-col items-center">
            <Image src={v.img} alt={v.title} width={400} height={300} className="rounded-lg mb-2" />
            <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{v.title}</h3>
          </div>
        </Link>
      ))}
    </div>
  );
}
