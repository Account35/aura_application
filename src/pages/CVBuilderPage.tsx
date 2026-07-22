import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layouts/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { generateSingleTurn, getCVBuilderProfile, upsertCVBuilderProfile } from '@/db/api';
import type {
  CVBuilderData,
  CVCertification,
  CVEducation,
  CVReference,
  CVWorkExperience,
} from '@/types/types';
import { hasPersonalisedCVAccess } from '@/lib/planUtils';
import { downloadATSReadableCVAsPDF, downloadATSReadableCVAsWord } from '@/lib/pdfUtils';
import { FileEdit, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function newId(): string {
  return crypto.randomUUID();
}

function emptyExperience(): CVWorkExperience {
  return {
    id: newId(),
    jobTitle: '',
    companyName: '',
    startDate: '',
    endDate: '',
    currentlyWorking: false,
    responsibilities: '',
  };
}

function emptyEducation(): CVEducation {
  return {
    id: newId(),
    qualificationName: '',
    institutionName: '',
    yearCompleted: '',
    achievements: '',
  };
}

function emptyCertification(): CVCertification {
  return {
    id: newId(),
    name: '',
    issuingOrganisation: '',
    dateObtained: '',
  };
}

function emptyReference(): CVReference {
  return {
    id: newId(),
    name: '',
    relationship: '',
    contactNumber: '',
  };
}

function createEmptyCVData(): CVBuilderData {
  return {
    personalDetails: {
      fullName: '',
      phoneNumber: '',
      emailAddress: '',
      cityProvince: '',
      targetJobTitle: '',
    },
    personalSummary: '',
    workExperience: [emptyExperience()],
    education: [emptyEducation()],
    skills: {
      technical: '',
      soft: '',
    },
    certifications: [emptyCertification()],
    references: [emptyReference()],
  };
}

function normalizeCVData(data: CVBuilderData | null | undefined): CVBuilderData {
  const empty = createEmptyCVData();
  if (!data) return empty;

  return {
    personalDetails: { ...empty.personalDetails, ...data.personalDetails },
    personalSummary: data.personalSummary ?? '',
    workExperience: data.workExperience?.length ? data.workExperience : empty.workExperience,
    education: data.education?.length ? data.education : empty.education,
    skills: { ...empty.skills, ...data.skills },
    certifications: data.certifications?.length ? data.certifications : empty.certifications,
    references: data.references?.length ? data.references : empty.references,
  };
}

function sortExperience(entries: CVWorkExperience[]): CVWorkExperience[] {
  return [...entries].sort((a, b) => {
    const aDate = a.currentlyWorking ? '9999-12' : a.endDate || a.startDate;
    const bDate = b.currentlyWorking ? '9999-12' : b.endDate || b.startDate;
    return bDate.localeCompare(aDate);
  });
}

function buildPrompt(data: CVBuilderData): string {
  return `Target Job Title:
${data.personalDetails.targetJobTitle}

Candidate CV Builder Data:
${JSON.stringify(data, null, 2)}

Generate the final CV using the exact ATS-readable layout rules.`;
}

function isCVStarted(data: CVBuilderData): boolean {
  return Boolean(
    data.personalDetails.fullName.trim() ||
      data.personalDetails.targetJobTitle.trim() ||
      data.personalSummary.trim() ||
      data.workExperience.some((entry) => entry.jobTitle.trim() || entry.companyName.trim())
  );
}

function isHeadingLine(trimmed: string): boolean {
  return (
    trimmed.length > 3 &&
    trimmed === trimmed.toUpperCase() &&
    !trimmed.startsWith('-') &&
    !trimmed.startsWith('•') &&
    !trimmed.includes('@')
  );
}

function renderCVPreview(cvText: string) {
  const lines = cvText.split('\n');
  const elements: React.ReactNode[] = [];

  // Line 0 = full name (centered, large bold)
  const nameLine = lines[0]?.trim() ?? '';
  if (nameLine) {
    elements.push(
      <p
        key="cv-name"
        style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', color: '#000', marginBottom: 4 }}
      >
        {nameLine}
      </p>
    );
  }

  // Line 1 = contact details (centered, regular 13px)
  const contactLine = lines[1]?.trim() ?? '';
  if (contactLine) {
    elements.push(
      <p
        key="cv-contact"
        style={{ fontSize: 13, fontWeight: 400, textAlign: 'center', color: '#000', marginBottom: 8 }}
      >
        {contactLine}
      </p>
    );
  }

  // Top divider after contact
  elements.push(
    <hr key="cv-top-divider" style={{ border: 'none', borderTop: '1px solid #ccc', margin: '4px 0 12px' }} />
  );

  let i = 2;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (isHeadingLine(trimmed)) {
      // Section heading + divider
      elements.push(
        <div key={`heading-${i}`} style={{ marginTop: 14, marginBottom: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#000', textTransform: 'uppercase', margin: 0 }}>
            {trimmed}
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '3px 0 6px' }} />
        </div>
      );
      i++;
      continue;
    }

    // Bullet point
    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      const bulletText = trimmed.replace(/^[-•]\s*/, '');
      elements.push(
        <p
          key={`bullet-${i}`}
          style={{ fontSize: 13, color: '#000', lineHeight: 1.6, margin: '0 0 2px 16px' }}
        >
          {'• '}{bulletText}
        </p>
      );
      i++;
      continue;
    }

    // Check if next non-empty line looks like a sub-line (company, institution, etc.)
    // Try to detect date-right-aligned pattern: "Bold Left Text   DATE"
    // We look for lines that have a date-like suffix (e.g. "Jan 2020 - Dec 2022" or "2020")
    const datePattern = /(\d{4}|Present|present)/;
    const hasDate = datePattern.test(trimmed);

    // Peek ahead: if next line is non-empty and not a heading/bullet, it's a sub-line
    const nextTrimmed = lines[i + 1]?.trim() ?? '';
    const nextIsSubLine =
      nextTrimmed &&
      !isHeadingLine(nextTrimmed) &&
      !nextTrimmed.startsWith('-') &&
      !nextTrimmed.startsWith('•');

    if (hasDate && nextIsSubLine) {
      // Entry header line: split on last occurrence of date-like segment for right-align
      const match = trimmed.match(/^(.+?)\s{2,}(.+)$/);
      if (match) {
        elements.push(
          <div key={`entry-header-${i}`} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>{match[1].trim()}</span>
            <span style={{ fontSize: 13, fontWeight: 400, color: '#000' }}>{match[2].trim()}</span>
          </div>
        );
      } else {
        elements.push(
          <p key={`entry-header-${i}`} style={{ fontSize: 13, fontWeight: 700, color: '#000', margin: '6px 0 0' }}>
            {trimmed}
          </p>
        );
      }
      i++;
      // Sub-line (company name / institution)
      if (nextTrimmed) {
        elements.push(
          <p key={`entry-sub-${i}`} style={{ fontSize: 13, fontWeight: 400, color: '#000', margin: '0 0 2px' }}>
            {nextTrimmed}
          </p>
        );
        i++;
      }
      continue;
    }

    // Plain paragraph line
    elements.push(
      <p
        key={`line-${i}`}
        style={{ fontSize: 13, fontWeight: 400, color: '#000', lineHeight: 1.6, margin: '0 0 2px' }}
      >
        {trimmed}
      </p>
    );
    i++;
  }

  return elements;
}

export function formatCVBuilderDataAsText(data: CVBuilderData): string {
  const personal = data.personalDetails;
  const lines: string[] = [
    personal.fullName,
    [personal.phoneNumber, personal.emailAddress, personal.cityProvince].filter(Boolean).join(' | '),
    '',
    'PERSONAL SUMMARY',
    data.personalSummary,
    '',
    'EXPERIENCE',
  ];

  sortExperience(data.workExperience).forEach((entry) => {
    if (!entry.jobTitle && !entry.companyName && !entry.responsibilities) return;
    lines.push(entry.jobTitle);
    lines.push(
      [
        entry.companyName,
        [entry.startDate, entry.currentlyWorking ? 'Present' : entry.endDate].filter(Boolean).join(' - '),
      ]
        .filter(Boolean)
        .join(' | ')
    );
    entry.responsibilities
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => lines.push(item.startsWith('-') ? item : `- ${item}`));
    lines.push('');
  });

  lines.push('EDUCATION');
  data.education.forEach((entry) => {
    if (!entry.qualificationName && !entry.institutionName) return;
    lines.push(entry.qualificationName);
    lines.push([entry.institutionName, entry.yearCompleted].filter(Boolean).join(' | '));
    if (entry.achievements) lines.push(entry.achievements);
    lines.push('');
  });

  lines.push('SKILLS');
  if (data.skills.technical) lines.push(`Technical Skills: ${data.skills.technical}`);
  if (data.skills.soft) lines.push(`Soft Skills: ${data.skills.soft}`);
  lines.push('', 'CERTIFICATIONS AND ACHIEVEMENTS');
  data.certifications.forEach((entry) => {
    if (!entry.name && !entry.issuingOrganisation) return;
    lines.push([entry.name, entry.issuingOrganisation, entry.dateObtained].filter(Boolean).join(' | '));
  });
  lines.push('', 'REFERENCES');
  data.references.forEach((entry) => {
    if (!entry.name && !entry.relationship && !entry.contactNumber) return;
    lines.push([entry.name, entry.relationship, entry.contactNumber].filter(Boolean).join(' | '));
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export default function CVBuilderPage() {
  const { user, profile } = useAuth();
  const [cvData, setCvData] = useState<CVBuilderData>(() => createEmptyCVData());
  const [generatedCV, setGeneratedCV] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const hasHydrated = useRef(false);
  const lastSavedSnapshot = useRef('');

  const hasAccess = hasPersonalisedCVAccess(profile);
  const fileNameBase = useMemo(
    () => `${cvData.personalDetails.fullName || 'aur-a-cv'}-${cvData.personalDetails.targetJobTitle || 'cv'}`,
    [cvData.personalDetails.fullName, cvData.personalDetails.targetJobTitle]
  );

  useEffect(() => {
    if (!user || !hasAccess) {
      setLoading(false);
      return;
    }

    getCVBuilderProfile(user.id).then((saved) => {
      const nextData = normalizeCVData(saved?.data);
      const nextGeneratedCV = saved?.generated_cv ?? '';
      setCvData(nextData);
      setGeneratedCV(nextGeneratedCV);
      lastSavedSnapshot.current = JSON.stringify({ data: nextData, generatedCV: nextGeneratedCV });
      hasHydrated.current = true;
      setLoading(false);
    });
  }, [user, hasAccess]);

  useEffect(() => {
    if (!user || !hasAccess || loading || !hasHydrated.current) return;

    const snapshot = JSON.stringify({ data: cvData, generatedCV });
    if (snapshot === lastSavedSnapshot.current) return;

    const timeout = window.setTimeout(async () => {
      setAutoSaving(true);
      const ok = await upsertCVBuilderProfile(user.id, cvData, generatedCV || null);
      if (ok) lastSavedSnapshot.current = snapshot;
      setAutoSaving(false);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [cvData, generatedCV, hasAccess, loading, user]);

  const saveProfile = async (nextGeneratedCV?: string | null) => {
    if (!user) return false;
    setSaving(true);
    const ok = await upsertCVBuilderProfile(user.id, cvData, nextGeneratedCV);
    setSaving(false);
    if (ok) {
      lastSavedSnapshot.current = JSON.stringify({
        data: cvData,
        generatedCV: nextGeneratedCV ?? generatedCV,
      });
      toast.success('CV changes saved');
    }
    else toast.error('Unable to save your CV changes');
    return ok;
  };

  const updatePersonal = (
    field: keyof CVBuilderData['personalDetails'],
    value: string
  ) => {
    setCvData((current) => ({
      ...current,
      personalDetails: { ...current.personalDetails, [field]: value },
    }));
  };

  const updateArrayEntry = <T extends { id: string }>(
    key: 'workExperience' | 'education' | 'certifications' | 'references',
    id: string,
    updates: Partial<T>
  ) => {
    setCvData((current) => ({
      ...current,
      [key]: (current[key] as unknown as T[]).map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      ),
    }));
  };

  const removeArrayEntry = (
    key: 'workExperience' | 'education' | 'certifications' | 'references',
    id: string
  ) => {
    setCvData((current) => ({
      ...current,
      [key]: current[key].filter((entry) => entry.id !== id),
    }));
  };

  const handleGenerate = async () => {
    if (!user) return;
    if (!cvData.personalDetails.fullName.trim() || !cvData.personalDetails.targetJobTitle.trim()) {
      toast.error('Add your full name and target job title before generating');
      return;
    }

    setGenerating(true);
    await upsertCVBuilderProfile(user.id, cvData);
    const result = await generateSingleTurn('cv_builder', buildPrompt(cvData));
    if (!result) {
      toast.error('Unable to generate your CV');
      setGenerating(false);
      return;
    }

    setGeneratedCV(result);
    await upsertCVBuilderProfile(user.id, cvData, result);
    toast.success('CV generated');
    setGenerating(false);
  };

  if (!hasAccess) {
    return (
      <Layout>
        <div className="relative max-w-5xl mx-auto">
          <div className="pointer-events-none select-none blur-sm opacity-45 space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">CV Builder</h1>
              <p className="text-secondary">Build and refine an ATS friendly CV over time.</p>
            </div>
            {[1, 2, 3].map((item) => (
              <Card key={item} className="border-border">
                <CardHeader>
                  <CardTitle>Professional CV Section</CardTitle>
                  <CardDescription>Saved profile fields and AI refinement preview</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="h-11 rounded-md bg-muted" />
                  <div className="h-11 rounded-md bg-muted" />
                  <div className="h-24 rounded-md bg-muted sm:col-span-2" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="absolute inset-0 flex items-start justify-center pt-24">
            <Card className="w-full max-w-lg border-border bg-card/95 shadow-2xl">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Lock className="h-5 w-5" />
                </div>
                <CardTitle className="text-2xl">Career Accelerator Feature</CardTitle>
                <CardDescription className="text-base">
                  CV Builder is available on the Career Accelerator plan only. Upgrade to build,
                  save, generate, and download your ATS friendly CV.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to="/plans">View Plans</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-8 pb-28">
        <div>
          <div className="mb-3 flex items-center gap-3 text-accent">
            <FileEdit className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-normal">Career Accelerator</span>
          </div>
          <h1 className="text-4xl font-bold mb-2 text-balance">CV Builder</h1>
          <p className="text-lg text-secondary text-pretty">
            Build a professional ATS friendly CV by filling in your information. Your profile is
            saved and can be refined over time as you retarget it for different roles.
          </p>
        </div>

        {loading ? (
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 p-6 text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your CV profile...
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={cvData.personalDetails.fullName} onChange={(event) => updatePersonal('fullName', event.target.value)} className="bg-muted border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input id="phoneNumber" value={cvData.personalDetails.phoneNumber} onChange={(event) => updatePersonal('phoneNumber', event.target.value)} className="bg-muted border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input id="emailAddress" type="email" value={cvData.personalDetails.emailAddress} onChange={(event) => updatePersonal('emailAddress', event.target.value)} className="bg-muted border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cityProvince">City and Province</Label>
                  <Input id="cityProvince" value={cvData.personalDetails.cityProvince} onChange={(event) => updatePersonal('cityProvince', event.target.value)} className="bg-muted border-border" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="targetJobTitle">Target Job Title</Label>
                  <Input id="targetJobTitle" value={cvData.personalDetails.targetJobTitle} onChange={(event) => updatePersonal('targetJobTitle', event.target.value)} placeholder="e.g. Junior Data Analyst" className="bg-muted border-border" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Personal Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={cvData.personalSummary} onChange={(event) => setCvData((current) => ({ ...current, personalSummary: event.target.value }))} rows={6} className="bg-muted border-border" />
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Work Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {sortExperience(cvData.workExperience).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input placeholder="Job title" value={entry.jobTitle} onChange={(event) => updateArrayEntry<CVWorkExperience>('workExperience', entry.id, { jobTitle: event.target.value })} className="bg-muted border-border" />
                      <Input placeholder="Company name" value={entry.companyName} onChange={(event) => updateArrayEntry<CVWorkExperience>('workExperience', entry.id, { companyName: event.target.value })} className="bg-muted border-border" />
                      <Input type="month" value={entry.startDate} onChange={(event) => updateArrayEntry<CVWorkExperience>('workExperience', entry.id, { startDate: event.target.value })} className="bg-muted border-border" />
                      <Input type="month" value={entry.endDate} disabled={entry.currentlyWorking} onChange={(event) => updateArrayEntry<CVWorkExperience>('workExperience', entry.id, { endDate: event.target.value })} className="bg-muted border-border disabled:opacity-50" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-secondary">
                      <Checkbox checked={entry.currentlyWorking} onCheckedChange={(checked) => updateArrayEntry<CVWorkExperience>('workExperience', entry.id, { currentlyWorking: checked === true, endDate: checked === true ? '' : entry.endDate })} />
                      Currently working here
                    </label>
                    <Textarea placeholder="Responsibilities and achievements" value={entry.responsibilities} onChange={(event) => updateArrayEntry<CVWorkExperience>('workExperience', entry.id, { responsibilities: event.target.value })} rows={4} className="bg-muted border-border" />
                    <Button type="button" variant="outline" size="sm" onClick={() => removeArrayEntry('workExperience', entry.id)} className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setCvData((current) => ({ ...current, workExperience: [emptyExperience(), ...current.workExperience] }))} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Experience
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Education and Qualifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {cvData.education.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input placeholder="Qualification name" value={entry.qualificationName} onChange={(event) => updateArrayEntry<CVEducation>('education', entry.id, { qualificationName: event.target.value })} className="bg-muted border-border" />
                      <Input placeholder="Institution name" value={entry.institutionName} onChange={(event) => updateArrayEntry<CVEducation>('education', entry.id, { institutionName: event.target.value })} className="bg-muted border-border" />
                      <Input placeholder="Year completed" value={entry.yearCompleted} onChange={(event) => updateArrayEntry<CVEducation>('education', entry.id, { yearCompleted: event.target.value })} className="bg-muted border-border" />
                    </div>
                    <Input placeholder="Notable achievements or modules" value={entry.achievements} onChange={(event) => updateArrayEntry<CVEducation>('education', entry.id, { achievements: event.target.value })} className="bg-muted border-border" />
                    <Button type="button" variant="outline" size="sm" onClick={() => removeArrayEntry('education', entry.id)} className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setCvData((current) => ({ ...current, education: [...current.education, emptyEducation()] }))} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Qualification
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="technicalSkills">Technical Skills</Label>
                  <Textarea id="technicalSkills" value={cvData.skills.technical} onChange={(event) => setCvData((current) => ({ ...current, skills: { ...current.skills, technical: event.target.value } }))} rows={6} className="bg-muted border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="softSkills">Soft Skills</Label>
                  <Textarea id="softSkills" value={cvData.skills.soft} onChange={(event) => setCvData((current) => ({ ...current, skills: { ...current.skills, soft: event.target.value } }))} rows={6} className="bg-muted border-border" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Certifications and Achievements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {cvData.certifications.map((entry) => (
                  <div key={entry.id} className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input placeholder="Name" value={entry.name} onChange={(event) => updateArrayEntry<CVCertification>('certifications', entry.id, { name: event.target.value })} className="bg-muted border-border" />
                    <Input placeholder="Issuing organisation" value={entry.issuingOrganisation} onChange={(event) => updateArrayEntry<CVCertification>('certifications', entry.id, { issuingOrganisation: event.target.value })} className="bg-muted border-border" />
                    <Input type="month" value={entry.dateObtained} onChange={(event) => updateArrayEntry<CVCertification>('certifications', entry.id, { dateObtained: event.target.value })} className="bg-muted border-border" />
                    <Button type="button" variant="outline" size="icon" onClick={() => removeArrayEntry('certifications', entry.id)} aria-label="Remove certification">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setCvData((current) => ({ ...current, certifications: [...current.certifications, emptyCertification()] }))} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>References</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {cvData.references.map((entry) => (
                  <div key={entry.id} className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input placeholder="Reference name" value={entry.name} onChange={(event) => updateArrayEntry<CVReference>('references', entry.id, { name: event.target.value })} className="bg-muted border-border" />
                    <Input placeholder="Relationship" value={entry.relationship} onChange={(event) => updateArrayEntry<CVReference>('references', entry.id, { relationship: event.target.value })} className="bg-muted border-border" />
                    <Input placeholder="Contact number" value={entry.contactNumber} onChange={(event) => updateArrayEntry<CVReference>('references', entry.id, { contactNumber: event.target.value })} className="bg-muted border-border" />
                    <Button type="button" variant="outline" size="icon" onClick={() => removeArrayEntry('references', entry.id)} aria-label="Remove reference">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setCvData((current) => ({ ...current, references: [...current.references, emptyReference()] }))} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Reference
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button size="lg" onClick={handleGenerate} disabled={generating || !isCVStarted(cvData)} className="gap-2 px-8">
                {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileEdit className="h-5 w-5" />}
                Generate CV
              </Button>
            </div>

            {generatedCV && (
              <Card className="border-border">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Generated CV Preview</CardTitle>
                      <CardDescription>Clean ATS readable layout, ready for PDF or Word export.</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" onClick={() => downloadATSReadableCVAsPDF(generatedCV, fileNameBase)}>
                        Download as PDF
                      </Button>
                      <Button variant="outline" onClick={() => downloadATSReadableCVAsWord(generatedCV, fileNameBase)}>
                        Download as Word
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    style={{
                      background: '#fff',
                      padding: '40px',
                      fontFamily: 'Inter, sans-serif',
                      color: '#000',
                      lineHeight: 1.6,
                      borderRadius: 8,
                      boxShadow: 'inset 0 0 0 1px #e5e7eb',
                    }}
                  >
                    {renderCVPreview(generatedCV)}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {hasAccess && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4 lg:ml-64">
            <p className="hidden text-sm text-secondary sm:block">
              {autoSaving ? 'Autosaving your latest CV Builder changes...' : 'Your CV Builder changes are autosaved.'}
            </p>
            <Button onClick={() => saveProfile(generatedCV || undefined)} disabled={saving || loading} className="ml-auto min-w-36">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
