import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { getCoverLetters, deleteCoverLetter, updateCoverLetterStatus, updateApplicationReminder } from '@/db/api';
import type { ApplicationStatus, CoverLetter } from '@/types/types';
import { Bell, FileText, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [reminderLetter, setReminderLetter] = useState<CoverLetter | null>(null);
  const [reminderSelection, setReminderSelection] = useState<CoverLetter['reminder_interval']>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  const statuses: ApplicationStatus[] = ['Applied', 'In Progress', 'Interview', 'Offer Received', 'Taken'];
  const statusStyle: Record<ApplicationStatus, string> = {
    Applied: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    'In Progress': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    Interview: 'border-accent/40 bg-accent/10 text-accent',
    'Offer Received': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    Taken: 'border-green-500/40 bg-green-500/15 text-green-300',
  };

  const handleStatusChange = async (letter: CoverLetter, status: ApplicationStatus) => {
    if (letter.application_status === status) return;
    const previousStatus = letter.application_status;
    const previousReminderAt = letter.next_reminder_at;
    const intervalDays = letter.reminder_interval === 'daily' ? 1 : letter.reminder_interval === 'every_2_days' ? 2 : letter.reminder_interval === 'every_3_days' ? 3 : null;
    const nextReminderAt = intervalDays ? new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString() : null;
    setCoverLetters((items) => items.map((item) => item.id === letter.id ? { ...item, application_status: status, next_reminder_at: nextReminderAt } : item));
    setSavingStatus(letter.id);
    const saved = await updateCoverLetterStatus(letter.id, status, letter.reminder_interval);
    setSavingStatus(null);
    if (!saved) {
      setCoverLetters((items) => items.map((item) => item.id === letter.id ? { ...item, application_status: previousStatus, next_reminder_at: previousReminderAt } : item));
      toast.error('Could not save application status. Please try again.');
      return;
    }
    if (status === 'Interview') toast.success('Application status updated. Your interview preparation prompt is ready.');
  };

  const saveReminder = async () => {
    if (!reminderLetter) return;
    setSavingReminder(true);
    const saved = await updateApplicationReminder(reminderLetter.id, reminderSelection);
    setSavingReminder(false);
    if (!saved) {
      toast.error('Could not save reminder preference. Please try again.');
      return;
    }
    const days = reminderSelection === 'daily' ? 1 : reminderSelection === 'every_2_days' ? 2 : reminderSelection === 'every_3_days' ? 3 : null;
    setCoverLetters((items) => items.map((item) => item.id === reminderLetter.id ? {
      ...item,
      reminder_interval: reminderSelection,
      next_reminder_at: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
    } : item));
    setReminderLetter(null);
    toast.success(reminderSelection ? 'Application reminder saved.' : 'Application reminders turned off.');
  };

  const getRoleName = (letter: CoverLetter) => {
    if (letter.job_title?.trim()) return letter.job_title.trim();
    const match = letter.job_description.match(/(?:job\s*title|position|role)\s*[:\-]\s*([^\r\n]+)/i);
    return match?.[1]?.trim() || 'Application follow-up';
  };

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
              <Card key={letter.id} className="border-border hover:border-accent transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link to={`/history/${letter.id}`} className="block">
                          <CardTitle className="text-xl mb-2">{getRoleName(letter)}</CardTitle>
                          <CardDescription className="text-base line-clamp-2">
                            {formatDate(letter.created_at)} · {letter.content.substring(0, 110)}{letter.content.length > 110 ? '...' : ''}
                          </CardDescription>
                        </Link>
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
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label htmlFor={`status-${letter.id}`} className="text-sm text-muted-foreground">Application status</label>
                      <select
                        id={`status-${letter.id}`}
                        value={letter.application_status || 'Applied'}
                        disabled={savingStatus === letter.id}
                        onChange={(event) => handleStatusChange(letter, event.target.value as ApplicationStatus)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 ${statusStyle[letter.application_status || 'Applied']}`}
                      >
                        {statuses.map((status) => <option key={status} value={status} className="bg-background text-foreground">{status}</option>)}
                      </select>
                      {savingStatus === letter.id && <span className="text-xs text-muted-foreground">Saving…</span>}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={() => { setReminderLetter(letter); setReminderSelection(letter.reminder_interval); }}
                      >
                        <Bell className="mr-2 h-4 w-4" />
                        {letter.reminder_interval ? 'Reminder settings' : 'Set reminder'}
                      </Button>
                    </div>
                    {letter.application_status === 'Interview' && (
                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
                        <p className="text-sm text-secondary">Would you like to start a mock interview for this application?</p>
                        <Button size="sm" onClick={() => navigate('/mock-interview', { state: { coverLetter: letter } })}>
                          <Video className="mr-2 h-4 w-4" /> Prepare for Interview
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                </Card>
            ))}
          </div>
        )}

        <Dialog open={!!reminderLetter} onOpenChange={(open) => { if (!open) setReminderLetter(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Application reminder</DialogTitle>
              <DialogDescription>Choose how often Aur.a should remind you to update {reminderLetter ? getRoleName(reminderLetter) : 'this application'}.</DialogDescription>
            </DialogHeader>
            <RadioGroup value={reminderSelection ?? 'none'} onValueChange={(value) => setReminderSelection(value === 'none' ? null : value as NonNullable<CoverLetter['reminder_interval']>)} className="gap-3 py-2">
              {[
                ['daily', 'Remind me every day'],
                ['every_2_days', 'Remind me every two days'],
                ['every_3_days', 'Remind me every three days'],
                ['none', 'No reminder'],
              ].map(([value, label]) => (
                <div key={value} className="flex items-center gap-3">
                  <RadioGroupItem value={value} id={`reminder-${value}`} />
                  <Label htmlFor={`reminder-${value}`} className="font-normal cursor-pointer">{label}</Label>
                </div>
              ))}
            </RadioGroup>
            <DialogFooter>
              <Button type="button" onClick={saveReminder} disabled={savingReminder}>
                {savingReminder ? 'Saving…' : 'Save reminder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
