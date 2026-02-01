import { Deal, Product } from '@/lib/types';
import { AttachmentCard } from './attachment-card';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';

interface MentionParserProps {
  content: string;
}

// Utility do parsowania @mentions w treści posta
async function parseMentions(content: string): Promise<{
  text: string;
  mentions: Array<{ type: 'deal' | 'product' | 'user'; id: string; item?: Deal | Product | { id: string; displayName?: string; email?: string } }>;
}> {
  const mentionRegex = /@(deal|product|user):([a-zA-Z0-9_-]+)/g;
  const mentions: Array<{ type: 'deal' | 'product' | 'user'; id: string; item?: Deal | Product | { id: string; displayName?: string; email?: string } }> = [];
  
  const matches = Array.from(content.matchAll(mentionRegex));
  for (const match of matches) {
    const type = match[1] as 'deal' | 'product' | 'user';
    const id = match[2];
    
    // Fetch item from Firestore
    try {
      if (type === 'user') {
        const usersRef = collection(db, 'users');
        const userDoc = await getDoc(doc(usersRef, id));

        if (userDoc.exists()) {
          const data = userDoc.data();
          mentions.push({
            type,
            id: userDoc.id,
            item: { id: userDoc.id, displayName: data?.displayName, email: data?.email },
          });
        } else {
          const byName = await getDocs(query(usersRef, where('displayName', '==', id), limit(1)));
          const matchDoc = byName.docs[0];
          if (matchDoc) {
            const data = matchDoc.data();
            mentions.push({
              type,
              id: matchDoc.id,
              item: { id: matchDoc.id, displayName: data?.displayName, email: data?.email },
            });
          }
        }
      } else {
        const collectionName = type === 'deal' ? 'deals' : 'product_cores';
        const docRef = doc(db, collectionName, id);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          mentions.push({
            type,
            id,
            item: { id: snap.id, ...snap.data() } as Deal | Product,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${type}:${id}`, error);
    }
  }
  
  // Remove @mentions from text
  const cleanText = content.replace(mentionRegex, (match, type, id) => {
    if (type === 'user') return `@${id}`;
    return '';
  });
  
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
          {mentions.map((mention, idx) => {
            if (!mention.item) return null;
            if (mention.type === 'user') {
              const user = mention.item as { id: string; displayName?: string; email?: string };
              return (
                <div key={`user-${mention.id}-${idx}`} className="text-sm text-muted-foreground">
                  Oznaczono: <span className="font-medium">@{user.displayName || user.email || mention.id}</span>
                </div>
              );
            }

            return (
              <AttachmentCard
                key={`${mention.type}-${mention.id}-${idx}`}
                item={mention.item as Deal | Product}
                type={mention.type}
                variant="compact"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
