import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Layout from '@/components/layouts/Layout';
import { getCoverLetterById } from '@/db/api';
import type { CoverLetter } from '@/types/types';
import { ArrowLeft, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoverLetter = async () => {
      if (!id || !user) return;

      const letter = await getCoverLetterById(id);
      if (!letter || letter.user_id !== user.id) {
        toast.error('Cover letter not found');
        navigate('/history');
        return;
      }

      setCoverLetter(letter);
      setLoading(false);
    };

    fetchCoverLetter();
  }, [id, user, navigate]);

  const handleCopy = () => {
    if (coverLetter) {
      navigator.clipboard.writeText(coverLetter.content);
      toast.success('Cover letter copied to clipboard');
    }
  };

  const handleDownload = () => {
    if (coverLetter) {
      const blob = new Blob([coverLetter.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cover-letter-${new Date(coverLetter.created_at).toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Cover letter downloaded');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate('/history')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to History
        </Button>

        {loading ? (
          <Card className="border-border">
            <CardHeader>
              <Skeleton className="h-8 w-48 bg-muted" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full bg-muted" />
            </CardContent>
          </Card>
        ) : coverLetter ? (
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl mb-2">Cover Letter</CardTitle>
                  <p className="text-secondary">
                    Generated on {formatDate(coverLetter.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleDownload}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                  {coverLetter.content}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}
