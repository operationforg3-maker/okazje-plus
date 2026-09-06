'use client';

import CommentSectionV2 from './comment-section-v2';
import type { Comment } from '@/lib/types';

interface CommentSectionProps {
  collectionName: 'products' | 'deals' | 'articles';
  docId: string;
  initialComments?: Comment[];
}

export default function CommentSection({ collectionName, docId }: CommentSectionProps) {
  const validCollection = collectionName === 'deals' ? 'deals' : 'products';
  return (
    <CommentSectionV2
      collectionName={validCollection}
      docId={docId}
    />
  );
}

export { CommentSectionV2 };
