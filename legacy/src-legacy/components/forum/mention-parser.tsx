import { Deal, Product } from '@/lib/types';
import { AttachmentCard } from './attachment-card';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface MentionParserProps {
  content: string;
}

// Utility do parsowania @mentions w treści posta
async function parseMentions(content: string): Promise<{
  text: string;
  mentions: Array<{ type: 'deal' | 'product'; id: string; item?: Deal | Product }>;
}> {
  const mentionRegex = /@(deal|product):([a-zA-Z0-9_-]+)/g;
  const mentions: Array<{ type: 'deal' | 'product'; id: string; item?: Deal | Product }> = [];
  
  const matches = Array.from(content.matchAll(mentionRegex));
  for (const match of matches) {
    const type = match[1] as 'deal' | 'product';
    const id = match[2];
    
    // Fetch item from Firestore
    try {
      const collectionName = type === 'deal' ? 'deals' : 'products';
      const docRef = doc(db, collectionName, id);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        mentions.push({
          type,
          id,
          item: { id: snap.id, ...snap.data() } as Deal | Product,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch ${type}:${id}`, error);
    }
  }
  
  // Remove @mentions from text
  const cleanText = content.replace(mentionRegex, '');
  
  return { text: cleanText, mentions };
}

export async function MentionParser({ content }: MentionParserProps) {
  const { text, mentions } = await parseMentions(content);
  
  return (
    <div className="space-y-4">
      {/* Rendered text without @mentions */}
      <div className="whitespace-pre-wrap break-words">{text}</div>
      
      {/* Render attached items as cards */}
      {mentions.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          {mentions.map((mention, idx) => 
            mention.item ? (
              <AttachmentCard
                key={`${mention.type}-${mention.id}-${idx}`}
                item={mention.item}
                type={mention.type}
                variant="compact"
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
