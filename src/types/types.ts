export type UserPlan = 'free' | 'pro' | 'career_accelerator';
export type PlanStatus = 'active' | 'cancelled';

export interface Profile {
  id: string;
  name: string;
  email: string;
  plan: UserPlan;
  plan_status: PlanStatus;
  paystack_subscription_code: string | null;
  generation_count: number;
  generation_reset_date: string;
  trial_ends_at: string | null;
  cv_content: string | null;
  learning_hub_addon: boolean;
  learning_hub_plan_status: PlanStatus;
  learning_hub_subscription_code: string | null;
  learning_hub_start_date: string | null;
  learning_hub_renewal_date: string | null;
  plan_renewal_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoResult {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel_name: string;
  views: string;
  embed_url: string;
}

export interface VideoWatchProgress {
  id: string;
  user_id: string;
  category: string;
  video_id: string;
  video_title: string;
  thumbnail_url: string;
  channel_name: string;
  watched: boolean;
  watched_at: string | null;
  display_order: number;
  created_at: string;
}

export type LearningHubCategory =
  | 'interview_preparation'
  | 'cv_writing_tips'
  | 'job_application_strategies'
  | 'salary_negotiation'
  | 'professional_communication';

export interface CategoryMeta {
  key: LearningHubCategory;
  label: string;
  query: string;
}

export interface CoverLetter {
  id: string;
  user_id: string;
  content: string;
  job_description: string;
  cv_content: string;
  ats_score: number | null;
  ats_reasons: string | null;
  cv_summary: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  cover_letter_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_details: any;
  created_at: string;
}

export interface PersonalisedCV {
  id: string;
  user_id: string;
  content: string;
  job_title: string;
  job_description: string;
  cv_content: string;
  created_at: string;
}

export interface CVWorkExperience {
  id: string;
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
}

export interface CVEducation {
  id: string;
  qualificationName: string;
  institutionName: string;
  yearCompleted: string;
  achievements: string;
}

export interface CVCertification {
  id: string;
  name: string;
  issuingOrganisation: string;
  dateObtained: string;
}

export interface CVReference {
  id: string;
  name: string;
  relationship: string;
  contactNumber: string;
}

export interface CVBuilderData {
  personalDetails: {
    fullName: string;
    phoneNumber: string;
    emailAddress: string;
    cityProvince: string;
    targetJobTitle: string;
  };
  personalSummary: string;
  workExperience: CVWorkExperience[];
  education: CVEducation[];
  skills: {
    technical: string;
    soft: string;
  };
  certifications: CVCertification[];
  references: CVReference[];
}

export interface CVBuilderProfile {
  user_id: string;
  data: CVBuilderData;
  generated_cv: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanFeatures {
  name: string;
  price: string;
  generations: string;
  aiRefinement: string;
  atsScore: string;
  features: string[];
}
