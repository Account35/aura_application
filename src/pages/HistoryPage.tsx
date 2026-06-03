import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Layout from '@/components/layouts/Layout';
import { getCoverLetters, deleteCoverLetter } from '@/db/api';
import type { CoverLetter } from '@/types/types';
import { FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function HistoryPage() {
  const { user } = useAuth();
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchCoverLetters = async () => {
      if (!user) return;

      const letters = await getCoverLetters(user.id);
      setCoverLetters(letters);
      setLoading(false);
    };

    fetchCoverLetters();
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, letterId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLetterToDelete(letterId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!letterToDelete) return;

    setDeleting(true);
    const success = await deleteCoverLetter(letterToDelete);

    if (success) {
      setCoverLetters(coverLetters.filter((letter) => letter.id !== letterToDelete));
      toast.success('Cover letter deleted successfully');
    } else {
      toast.error('Failed to delete cover letter');
    }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setLetterToDelete(null);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Cover Letter History</h1>
          <p className="text-xl text-secondary">View all your generated cover letters</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border">
                <CardHeader>
                  <Skeleton className="h-6 w-32 bg-muted" />
                  <Skeleton className="h-4 w-full bg-muted" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : coverLetters.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl text-secondary mb-2">No cover letters yet</p>
              <p className="text-secondary">
                Generate your first cover letter to see it here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {coverLetters.map((letter) => (
              <Link key={letter.id} to={`/history/${letter.id}`}>
                <Card className="border-border hover:border-accent transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-2">
                          {formatDate(letter.created_at)}
                        </CardTitle>
                        <CardDescription className="text-base line-clamp-2">
                          {letter.content.substring(0, 150)}
                          {letter.content.length > 150 ? '...' : ''}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <FileText className="w-6 h-6 text-accent" />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteClick(e, letter.id)}
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Cover Letter</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this cover letter? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
