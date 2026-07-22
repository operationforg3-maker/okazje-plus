'use client';

import CommentSectionV2 from './comment-section-v2';
import type { Comment } from '@/lib/types';

interface CommentSectionProps {
  collectionName: 'products' | 'deals' | 'articles';
  docId: string;
  initialComments?: Comment[];
}

export default function CommentSection({ collectionName, docId, initialComments }: CommentSectionProps) {
  const targetType = collectionName === 'deals' ? 'deal' : collectionName === 'products' ? 'product' : 'forum';
  return (
    <CommentSectionV2
      targetType={targetType}
      targetId={docId}
      initialComments={initialComments}
    />
  );
}

export { CommentSectionV2 };
