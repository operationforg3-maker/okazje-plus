'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { addComment, getComments } from '@/lib/data';
import { Comment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CommentSectionProps {
  collectionName: 'products' | 'deals';
  docId: string;
}

export default function CommentSection({ collectionName, docId }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    async function fetchComments() {
      setComments(await getComments(collectionName, docId));
    }
    fetchComments();
  }, [collectionName, docId]);

  const handleSubmitComment = async () => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby dodać komentarz.");
      return;
    }
    if (!newComment.trim()) {
      return;
    }
    try {
      await addComment(collectionName, docId, user.uid, newComment);
      setNewComment('');
      // Refresh comments
      setComments(await getComments(collectionName, docId));
      toast.success("Komentarz został dodany.");
    } catch (error) {
      toast.error("Wystąpił błąd podczas dodawania komentarza.");
    }
  };

  return (
    <div className="mt-8">
      <h3 className="font-headline text-2xl font-bold mb-4">Komentarze</h3>
      {user && (
        <div className="mb-6">
          <Textarea 
            placeholder="Dodaj swój komentarz..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="mb-2"
          />
          <Button onClick={handleSubmitComment}>Dodaj komentarz</Button>
        </div>
      )}
      <div className="space-y-4">
        {comments.map(comment => (
          <div key={comment.id} className="border-l-4 border-primary pl-4">
            <p className="text-muted-foreground">
              {comment.userDisplayName || `Użytkownik ${comment.userId.substring(0, 6)}...`}
            </p>
            <p>{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
