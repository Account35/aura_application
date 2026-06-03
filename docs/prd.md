# Requirements Document

## 1. Application Overview

- **Application Name:** Aur.a
- **Description:** Aur.a is a full-stack career tool that helps job seekers generate professional, tailored cover letters and personalised CVs using AI. It provides ATS compatibility scoring, CV summarisation, an AI-powered chat panel for iterative cover letter refinement, background generation with persistent job tracking, and a Learning Hub with curated video content for career development. All AI capabilities are powered by OpenRouter.

---

## 2. Users & Use Cases

### 2.1 Target Users
- Job seekers who need to produce professional cover letters and personalised CVs quickly and efficiently.
- Users seeking career development resources through video learning content.

### 2.2 Core Use Cases
- A user signs up, uploads their CV and a job description, and receives a tailored cover letter, an ATS score, and a CV summary.
- A user generates a personalised CV tailored to a specific job description and downloads it as a PDF.
- A user starts a generation, navigates to another page, and receives a notification when generation completes in the background.
- A user refines their generated cover letter through a multi-turn AI chat panel.
- A user reviews their past cover letter generations from the History page.
- A user accesses Learning Hub to watch career development videos and track progress.
- A user updates their profile information and manages subscription from the Settings page.
- A user on a paid plan cancels their subscription and retains access until the billing end date.
- A user with a cancelled subscription reinstates it before the billing end date to resume automatic billing.

---

## 3. Design System

Applied universally across every page and component:

| Token | Value |
|---|---|
| Background | #0F172A |
| Surface / Card | #111827 |
| Border | #1F2937 |
| Primary Text | #F9FAFB |
| Secondary Text | #9CA3AF |
| Accent | #7C3AED (buttons, active states, links, focus rings only) |
| Font | Inter (loaded from Google Fonts, applied universally) |
| Card border-radius | 12px |
| Card padding | 24px |
| Card border | 1px solid #1F2937 |
| Button style | Accent background, medium rounded corners |
| Input style | Dark background, subtle border, accent-coloured focus ring |

---

## 4. Authentication

### 4.1 Sign Up
- Fields: name, email, password.
- A back button or icon is displayed in the top-left corner that navigates to the Landing Page.
- On successful sign-up, redirect to the Dashboard.
- All plan buttons on the Landing Page route to the Sign Up page.

### 4.2 Login
- Fields: email, password.
- A back button or icon is displayed in the top-left corner that navigates to the Landing Page.
- On successful login, redirect to the Dashboard.

### 4.3 Logout
- Available from the sidebar.
- On logout, redirect to the Landing Page.

### 4.4 Data Scoping
- All user data (cover letters, personalised CVs, generation count, profile, Learning Hub progress, subscription status) must be strictly scoped to the authenticated user.

---

## 5. AI Integration Rules

### 5.1 Environment Variable
- The OpenRouter API key must be stored as OPENROUTER_API_KEY in the environment file.
- It must be referenced exclusively as a server-side variable and must never be exposed to the client.

### 5.2 Single-Turn Call Pattern
- Send a POST request to https://openrouter.ai/api/v1/chat/completions.
- Headers:
  - Authorization: Bearer ${OPENROUTER_API_KEY}
  - Content-Type: application/json
- Body:
```json
{
  \"model\": \"openrouter/free\",
  \"messages\": [{\"role\": \"user\", \"content\": \"<prompt>\"}],
  \"reasoning\": {\"enabled\": true}
}
```
- Parse with response.json() and extract the message from result.choices[0].message.
- Used for: cover letter generation, ATS score generation, CV summary generation, personalised CV generation.

### 5.3 Multi-Turn Call Pattern
- Preserve the full message history array between calls.
- The assistant message's reasoning_details field must be passed back unmodified in each subsequent request.
- Each new user message is appended to the messages array; the full array is sent with every call.
- Used exclusively for: the AI chat refinement panel.

---

## 6. SerpApi Integration Rules

### 6.1 Environment Variable
- The SerpApi key must be stored as SERPAPI_KEY in the environment file.
- It must be referenced exclusively as a server-side variable and must never be exposed to the client.

### 6.2 YouTube Video Fetching
- Server-side GET request to: https://serpapi.com/search.json
- Parameters:
  - engine=youtube
  - search_query=<category query>
  - api_key=SERPAPI_KEY
- Extract from response: title, video ID, thumbnail URL, channel name, view count.
- Embed URL format: https://www.youtube.com/embed/<videoId>
- Each search returns 10 video results.

---

## 7. Page Structure & Feature Specification

```
Aur.a
├── Landing Page (public)
│   ├── Hero Section
│   ├── How It Works Section
│   ├── Benefits Section
│   ├── Pricing Section
│   └── Footer
├── Sign Up Page (public)
├── Login Page (public)
└── Authenticated App
    ├── Fixed Left Sidebar (navigation)
    ├── Dashboard (home)
    ├── Generate Cover Letter & Personalised CV
    ├── History
    ├── Learning Hub
    └── Settings
```

---

### 7.1 Landing Page

#### Hero Section
- Bold headline and subheading explaining what Aur.a does.
- A prominent call-to-action button labelled \"Get Started\" that routes to the Sign Up page.

#### How It Works Section
- Three sequential steps displayed visually:
  1. Upload your CV
  2. Paste the job description
  3. Generate your cover letter

#### Benefits Section
- Three benefit cards using the card design system.

#### Pricing Section
- Display-only cards. No payment processing of any kind.
- Three plans:

| Plan | Price Display | Inclusions |
|---|---|---|
| Free | Free forever | 10 generations/month, manual editing only, no AI refinement, no ATS score access, no personalised CV generation, no Learning Hub access |
| Pro | R30 for 2 months or R300/year | Unlimited generations, 3 AI refinement chat messages per cover letter, ATS score visible with reasons blurred, personalised CV generation, Learning Hub add-on available at R50 for 2 months or R250/year |
| Career Accelerator | R300/year | Unlimited generations, unlimited AI chat, full ATS score with reasons, personalised CV generation, Learning Hub add-on available at R100 for 2 months or R500/year |

- Each plan card has a button that routes to the Sign Up page.

#### Footer
- Text: \"Built with passion to help job seekers succeed, developed by Lwando Ntlemeza.\"

---

### 7.2 Sign Up Page
- A back button or icon in the top-left corner that navigates to the Landing Page.
- Fields: name, email, password.
- Link to Login page for existing users.

### 7.3 Login Page
- A back button or icon in the top-left corner that navigates to the Landing Page.
- Fields: email, password.
- Link to Sign Up page for new users.

---

### 7.4 Authenticated App Shell

#### Fixed Left Sidebar
- Navigation items (in order):
  1. Dashboard
  2. Generate Cover Letter
  3. History
  4. Learning Hub
  5. Settings
- Logout button at the bottom of the sidebar.
- Active navigation item uses the accent colour.
- Learning Hub nav item uses book or graduation cap icon, consistent with existing sidebar icons.
- Learning Hub nav item is visible to all users regardless of access level.

#### Persistent Generation Indicator
- A floating indicator is displayed across all authenticated pages when any background generation job is running.
- The indicator shows a spinner and text such as \"Generation in progress...\".
- The indicator is visible regardless of which page the user is currently on.
- When generation completes, the indicator updates to show \"Generation complete\" with a \"View Results\" button.
- Clicking \"View Results\" navigates the user to the Generate page and displays the completed results.
- The indicator dismisses automatically after the user views the results or manually closes it.

---

### 7.5 Dashboard (Home)
- Welcome message addressing the user by name.
- Display of the user's remaining generation count for the current month.
- A prominent button to navigate to the Generate Cover Letter page.

---

### 7.6 Generate Cover Letter & Personalised CV Page

The page contains two tabs:
1. Cover Letter (default)
2. Personalised CV

#### Tab 1: Cover Letter

The flow proceeds through the following steps in order:

**Step 1 — CV Input**
- The user may either:
  - Upload their CV as a PDF file (text is extracted server-side), or
  - Paste their CV as plain text into a text area.

**Step 2 — Job Description Input**
- A text area where the user pastes the target job description.

**Step 3 — Generate**
- The user clicks the \"Generate\" button.
- The application sends the extracted CV content and the job description to OpenRouter using the single-turn pattern with a well-structured system prompt instructing the AI to write a tailored, professional cover letter.
- Generation runs in the background. The user is not required to stay on the page.
- A spinner is displayed on the page while generation is in progress.
- The persistent floating indicator is displayed across all pages while generation is running.
- Generation consumes one generation credit from the user's monthly count.

**Output Area (rendered after generation completes, in order):**

**A. Cover Letter Card**
- Displays the generated cover letter in a clean card.
- Includes a \"Copy\" button and a \"Download\" button (downloads as a .txt or .docx file).

**B. ATS Score**
- A separate single-turn OpenRouter call analyses the CV against the job description and returns a compatibility score out of 100.
- Displayed as a numeric score (e.g., \"74 / 100\").
- Full score and reasons are visible to all users during the trial period.

**C. CV Summary**
- A third single-turn OpenRouter call generates a brief summary of the CV.
- Displayed below the ATS score.

**D. AI Chat Refinement Panel**
- A chat interface below the CV summary.
- Uses the multi-turn pattern: full message history is preserved and sent with every call; reasoning_details on every assistant message is passed back unmodified into subsequent requests.
- The user types a message to request refinements to the cover letter (e.g., \"Make the tone more formal\", \"Emphasise my leadership experience\").
- The AI responds with a refined version or targeted edits.
- Unlimited AI chat messages are available to all users during the trial period.
- Every generated cover letter (including the initial generation) is saved to the database linked to the authenticated user.

#### Tab 2: Personalised CV

**Access Control**
- Free users see a locked screen with a message stating they must upgrade to Pro or Career Accelerator to access personalised CV generation.
- Pro and Career Accelerator users have full access.

**Input Fields**
- The user may either:
  - Upload their existing CV as a PDF file (text is extracted server-side), or
  - Paste their existing CV as plain text into a text area.
- The user enters a job title.
- The user pastes a job description.

**Generate**
- The user clicks the \"Generate\" button.
- The application sends the CV content, job title, and job description to OpenRouter using the single-turn pattern with a system prompt instructing the AI to generate a fully restructured, ATS-optimised CV tailored to the job.
- The generated CV includes standard ATS-friendly sections: Summary, Skills, Work Experience, Education, Certifications (if applicable).
- Keywords from the job description are woven into the CV naturally.
- Generation runs in the background. The user is not required to stay on the page.
- A spinner is displayed on the page while generation is in progress.
- The persistent floating indicator is displayed across all pages while generation is running.
- Generation consumes one generation credit from the user's monthly count.

**Output Area**
- Displays the generated personalised CV in a clean card.
- Includes a \"Download as PDF\" button that generates and downloads a well-formatted, professional PDF.
- Every generated personalised CV is saved to the database linked to the authenticated user.

---

### 7.7 History Page
- Displays all past cover letter generations for the authenticated user as a list.
- Each list item shows:
  - Date of generation.
  - A short preview (first ~100 characters of the cover letter).
- Clicking any list item navigates to a detail view showing the full cover letter.

---

### 7.8 Learning Hub Page

#### Access Control
- Free users: See a locked screen with message stating they must upgrade to Pro or Career Accelerator to access Learning Hub. Screen includes a CTA button to the plans page.
- Pro/Career Accelerator users without Learning Hub add-on: See an upgrade prompt showing add-on cost (both 2-month and annual options) with a \"Pay Now\" button via Paystack.
- Pro/Career Accelerator users with active Learning Hub add-on: Full access to all Learning Hub features.

#### Category Tabs
- Five tabs displayed horizontally:
  1. Interview Preparation (default)
  2. CV Writing Tips
  3. Job Application Strategies
  4. Salary Negotiation
  5. Professional Communication

#### Category Search Queries

| Tab | Search Query |
|-----|-------------|
| Interview Preparation | job interview tips and techniques |
| CV Writing Tips | how to write a professional CV |
| Job Application Strategies | job application strategies for job seekers |
| Salary Negotiation | how to negotiate salary effectively |
| Professional Communication | professional communication skills for the workplace |

#### Progress Tracking
- Displayed below category tabs, above video grid.
- Per category: horizontal progress bar (accent violet fill, dark border track), percentage number, label (e.g. \"3 of 10 videos watched\").
- Percentage = (watched videos / total shown videos) × 100.
- Persists across sessions, updates in real-time when video marked as watched.
- Database tracks which videos each user has watched per category.

#### Video Grid
- Each category shows 10 videos initially in a grid layout.
- Each video card shows:
  - Thumbnail image (fills top of card)
  - Video title (primary text, semibold, max 2 lines truncated)
  - Channel name (secondary muted text, small font)
  - \"Watch Now\" button (accent color)
- Card design: dark surface, subtle border, 12px border radius, 24px padding.

#### Load More Behavior
- When ALL 10 videos in a category are marked as watched, automatically fetch 10 more from SerpApi using pagination/offset.
- If not all 10 watched, no additional loading occurs.

#### Video Modal Player
- Opens on \"Watch Now\" click, overlays Learning Hub page.
- Dark surface background, subtle border, 12px border radius.
- Shows:
  - Video title (primary heading)
  - YouTube iFrame embed (full width responsive)
  - Channel name (secondary text)
  - Close button (top right)
- On close: prompt asking \"Mark as watched?\" — if confirmed, recorded in database and reflected in progress tracker immediately.
- Video always plays inside modal, never redirects to YouTube.

---

### 7.9 Settings Page

#### Profile Section
- Allows the user to update their name and email.
- A save button submits the changes.

#### Billing Section
- Displays:
  - Base plan name
  - Base plan renewal date
  - Learning Hub add-on status (Active/Inactive)
  - Learning Hub add-on renewal date (if active)
  - 3-week extension applied to renewal date (if add-on active)
- All dates in human-readable format (day, month, year).

#### Subscription Cancellation
- For users on any paid plan (Pro, Career Accelerator, or Learning Hub add-on), a \"Cancel Subscription\" button is displayed below the billing details section.
- Clicking the button opens a confirmation modal.
- Modal content:
  - Clear statement: cancelling stops renewal on the next billing date; user retains full access until the existing billing end date; user can reinstate at any time before that end date.
  - Display the exact billing end date.
  - Two buttons: \"Confirm Cancellation\" (accent colour) and \"Go Back\" (secondary style).
- On confirmation:
  - Cancel the recurring Paystack subscription via Paystack API (no future charges).
  - Update user's plan_status in the database to \"cancelled\" but keep access expiry date unchanged.
  - Dismiss modal and show success toast confirming cancellation and reminding user of access end date.

#### Subscription Reinstatement
- For users with plan_status=\"cancelled\" and unexpired access, a \"Reinstate Subscription\" button is displayed in the billing section.
- Clicking the button opens a confirmation modal.
- Modal content:
  - Inform user that reinstating resumes automatic recurring billing from their existing billing end date (no gap or interruption).
  - Display the billing end date and the amount that will be charged on that date.
  - Two buttons: \"Confirm Reinstatement\" (accent colour) and \"Go Back\" (secondary style).
- On confirmation:
  - Reactivate the Paystack subscription so recurring billing resumes from existing end date.
  - Update plan_status back to \"active\" in the database.
  - Dismiss modal and show success toast confirming reinstatement with next billing date.

---

## 8. Business Rules & Logic

| Rule | Detail |
|---|---|
| Trial period | All accounts (both new and existing) receive a 5-day trial period starting from the moment of sign-up, during which all premium features are unlocked. |
| Trial features | During the trial period, users have access to: unlimited AI chat refinement, full ATS score with reasons visible, personalised CV generation, and all other premium features. |
| Generation count | All users (including trial users) have a monthly cap of 10 generations. Count resets at the start of each calendar month. |
| Generation count scope | Both cover letter generation and personalised CV generation consume from the same monthly generation count. |
| Generation enforcement | If a user has 0 remaining generations, the Generate button is disabled and a message is shown. |
| Post-trial restrictions | After the 5-day trial expires, Free plan users lose access to AI chat refinement, full ATS score visibility (score number hidden, reasons hidden), and personalised CV generation. |
| Background generation | When a user clicks Generate, the generation process runs in the background. The user can navigate to any other page without interrupting the generation. |
| Generation status tracking | A persistent floating indicator is displayed across all authenticated pages while any background generation job is running. |
| Generation completion notification | When generation completes, the floating indicator updates to show \"Generation complete\" with a \"View Results\" button. The user must manually click the button to view results. |
| Generation cancellation | Generation can only be cancelled explicitly by the user. Navigating away from the Generate page does not cancel the generation. |
| Inline results display | If the user is on the Generate page when generation completes, results are displayed inline immediately. |
| Personalised CV access | Free users cannot access personalised CV generation. Pro and Career Accelerator users have full access. |
| Personalised CV PDF | The generated personalised CV must be downloadable as a well-formatted, professional PDF. |
| Learning Hub access - Free users | Cannot access Learning Hub at all. Clicking the nav item shows a locked screen with upgrade prompt. |
| Learning Hub access - Pro users | Can unlock Learning Hub add-on at R50 for 2 months or R250/year. |
| Learning Hub access - Career Accelerator users | Can unlock Learning Hub add-on at R100 for 2 months or R500/year. |
| Learning Hub payment | Payment processed via Paystack. On successful payment, Learning Hub add-on activated immediately. |
| Add-on activation | Add-on start date recorded as payment date. Subscription renewal date extended by 3 weeks beyond current plan renewal date. |
| Add-on cancellation | If user cancels add-on before renewal, access continues until paid period ends. 3-week extension removed from next renewal calculation. |
| Video loading | Each category shows 10 videos initially. When all 10 marked as watched, automatically fetch 10 more. |
| Progress tracking | Database tracks which videos each user has watched per category. Progress persists across sessions. |
| API key security | OPENROUTER_API_KEY and SERPAPI_KEY must never appear in any client-side code, bundle, or network request visible to the browser. All API calls are made server-side. |
| Data isolation | A user can only read and write their own cover letters, personalised CVs, generation count, profile data, Learning Hub progress, and subscription status. |
| Cover letter persistence | Every generation is saved immediately upon successful AI response. |
| Personalised CV persistence | Every generated personalised CV is saved immediately upon successful AI response. |
| Plan assignment | For this build, all users are assigned the Free plan by default with a 5-day trial period. |
| Subscription cancellation | Users on paid plans can cancel their subscription at any time. Cancellation stops future recurring charges via Paystack API but does not immediately revoke access. |
| Access after cancellation | Feature access control checks both plan_status and access expiry date. A user with plan_status=\"cancelled\" but unexpired expiry date retains identical feature access as an active subscriber on that plan. |
| Access revocation | Access is only revoked after the expiry date passes, at which point the user is automatically downgraded to the free tier. |
| Subscription reinstatement | Users with plan_status=\"cancelled\" and unexpired access can reinstate their subscription at any time before the expiry date. Reinstatement resumes automatic recurring billing from the existing billing end date with no gap or interruption. |
| Plan status updates | All cancellation and reinstatement actions are processed through Paystack API. All plan status changes are recorded in the database immediately. |

---

## 9. Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| PDF upload fails or text extraction returns empty | Display an inline error: \"We couldn't extract text from your PDF. Please paste your CV as plain text instead.\" |
| Job description field is empty on generate | Disable the Generate button until both CV content and job description are present. |
| OpenRouter API returns an error or times out | Display a user-facing error message: \"Something went wrong generating your cover letter. Please try again.\" Do not expose raw API errors to the client. |
| ATS or summary call fails independently | Display a fallback message in the respective section (e.g., \"ATS score unavailable at this time.\") without blocking the cover letter display. |
| Background generation fails | Update the persistent floating indicator to show an error message: \"Generation failed. Please try again.\" Allow the user to dismiss the indicator. |
| User navigates away during generation | Generation continues in the background. The persistent floating indicator remains visible across all pages. |
| User closes browser during generation | Generation continues server-side. When the user returns and logs in, the persistent floating indicator shows the current status. |
| Multiple generations triggered simultaneously | Queue generations and process them sequentially. Display the status of the current generation in the persistent floating indicator. |
| User clicks \"View Results\" but results are not yet ready | Display a message: \"Generation is still in progress. Please wait.\" |
| Personalised CV PDF generation fails | Display an error message: \"Unable to generate PDF. Please try again.\" |
| SerpApi returns an error or times out | Display a user-facing error message: \"Unable to load videos at this time. Please try again later.\" |
| SerpApi returns fewer than 10 videos | Display all available videos. Do not show error. |
| Trial period expires | The system automatically restricts access to premium features (AI chat, full ATS score, personalised CV generation) based on the user's sign-up timestamp. |
| User attempts to access authenticated routes while logged out | Redirect to the Login page. |
| User attempts to access auth pages while already logged in | Redirect to the Dashboard. |
| Free user clicks Learning Hub nav item | Show locked screen with upgrade prompt. |
| Free user attempts to access Personalised CV tab | Show locked screen with upgrade prompt. |
| Pro/Career Accelerator user without add-on clicks Learning Hub nav item | Show upgrade prompt with add-on pricing and Paystack payment button. |
| Paystack payment fails | Display error message: \"Payment failed. Please try again or contact support.\" |
| Settings update fails | Display an inline error message below the form. |
| Video modal fails to load | Display error message: \"Unable to load video. Please try again.\" |
| Paystack cancellation API fails | Display error message: \"Unable to cancel subscription at this time. Please try again or contact support.\" Do not update plan_status in database. |
| Paystack reinstatement API fails | Display error message: \"Unable to reinstate subscription at this time. Please try again or contact support.\" Do not update plan_status in database. |
| User attempts to cancel a subscription that is already cancelled | Disable the \"Cancel Subscription\" button and display current status. |
| User attempts to reinstate a subscription that is already active | Disable the \"Reinstate Subscription\" button and display current status. |
| User attempts to cancel or reinstate after expiry date has passed | Do not show cancellation or reinstatement buttons. User must purchase a new subscription. |

---

## 10. Acceptance Criteria

1. The landing page renders all required sections (hero, how it works, benefits, pricing, footer) with the correct design system applied.
2. All pricing plan buttons route to the Sign Up page; no payment UI or logic exists on the landing page.
3. Pricing section displays updated Learning Hub add-on pricing for Pro and Career Accelerator plans.
4. The Sign Up page displays a back button or icon in the top-left corner that navigates to the Landing Page.
5. The Login page displays a back button or icon in the top-left corner that navigates to the Landing Page.
6. A new user can sign up with email and password and is redirected to the Dashboard.
7. An existing user can log in and log out successfully.
8. The authenticated sidebar is visible and functional on all authenticated pages.
9. The sidebar includes a Learning Hub nav item with book or graduation cap icon.
10. The Dashboard displays the correct user name and remaining generation count.
11. The Generate page contains two tabs: Cover Letter and Personalised CV.
12. A user can upload a PDF or paste plain text as their CV on both tabs.
13. A user can paste a job description and click Generate to receive a cover letter, ATS score, and CV summary on the Cover Letter tab.
14. A user can enter a job title, paste a job description, and click Generate to receive a personalised CV on the Personalised CV tab.
15. The cover letter can be copied to clipboard and downloaded.
16. The personalised CV can be downloaded as a well-formatted, professional PDF.
17. During the 5-day trial period, all users (both new and existing) have access to unlimited AI chat refinement, full ATS score with reasons, and personalised CV generation.
18. The AI chat refinement panel sends multi-turn requests with full message history and reasoning_details preserved.
19. When a user clicks Generate, the generation process runs in the background.
20. A persistent floating indicator is displayed across all authenticated pages while any background generation job is running.
21. The floating indicator shows a spinner and text such as \"Generation in progress...\" while generation is running.
22. When generation completes, the floating indicator updates to show \"Generation complete\" with a \"View Results\" button.
23. Clicking \"View Results\" navigates the user to the Generate page and displays the completed results.
24. If the user is on the Generate page when generation completes, results are displayed inline immediately.
25. Navigating away from the Generate page does not cancel the generation.
26. Every generated cover letter is saved and appears in the History page.
27. Every generated personalised CV is saved to the database.
28. Clicking a history item displays the full cover letter.
29. Free users clicking Learning Hub nav item see a locked screen with upgrade prompt.
30. Free users attempting to access Personalised CV tab see a locked screen with upgrade prompt.
31. Pro/Career Accelerator users without Learning Hub add-on see an upgrade prompt with add-on pricing and Paystack payment button.
32. Pro/Career Accelerator users with active Learning Hub add-on can access all Learning Hub features.
33. Pro and Career Accelerator users have full access to personalised CV generation.
34. Learning Hub displays five category tabs with correct default tab (Interview Preparation).
35. Each category fetches 10 videos from SerpApi using the correct search query.
36. Video cards display thumbnail, title, channel name, and \"Watch Now\" button.
37. Clicking \"Watch Now\" opens video modal with YouTube embed.
38. Video modal displays video title, channel name, and close button.
39. Closing video modal prompts \"Mark as watched?\" and records response in database.
40. Progress tracker displays correct percentage and watched count per category.
41. When all 10 videos in a category are marked as watched, 10 more videos are automatically fetched.
42. Paystack payment for Learning Hub add-on activates add-on immediately upon success.
43. Add-on activation extends subscription renewal date by 3 weeks.
44. Settings page displays base plan name, base plan renewal date, Learning Hub add-on status, and Learning Hub add-on renewal date (if active).
45. A user can update their name and email from the Settings page.
46. OPENROUTER_API_KEY and SERPAPI_KEY are never present in any client-side code or network request.
47. The 10 generations per month limit is enforced for all users regardless of trial status.
48. Both cover letter generation and personalised CV generation consume from the same monthly generation count.
49. After the trial period expires, Free plan users lose access to AI chat, full ATS score visibility, and personalised CV generation.
50. The design system (colours, typography, card styles, button styles, input styles) is applied consistently across every page including Learning Hub and the new Personalised CV tab.
51. No mock data or placeholder responses exist anywhere in the application.
52. Users on any paid plan see a \"Cancel Subscription\" button in the billing section of the Settings page.
53. Clicking \"Cancel Subscription\" opens a confirmation modal with clear messaging about access retention until billing end date and the option to reinstate.
54. Confirming cancellation cancels the recurring Paystack subscription, updates plan_status to \"cancelled\" in the database, and shows a success toast.
55. Users with plan_status=\"cancelled\" and unexpired access retain full feature access identical to active subscribers on that plan.
56. Users with plan_status=\"cancelled\" and unexpired access see a \"Reinstate Subscription\" button in the billing section.
57. Clicking \"Reinstate Subscription\" opens a confirmation modal with clear messaging about resuming billing from the existing end date.
58. Confirming reinstatement reactivates the Paystack subscription, updates plan_status to \"active\" in the database, and shows a success toast.
59. All cancellation and reinstatement modals use the existing dark design system with accent violet on primary action buttons.
60. All user-facing messages related to cancellation and reinstatement are clear, professional, and reassuring.
61. Cancellation and reinstatement features do not break any existing functionality.
62. Background generation and persistent job tracking features do not break any existing functionality.
63. Personalised CV generation and PDF download features do not break any existing functionality.

---

## 11. Out of Scope for This Build

- Payment processing or subscription management for base plans (Free, Pro, Career Accelerator).
- Plan upgrades or downgrades for base plans within the application.
- Email verification or password reset flows.
- OAuth or social login (e.g., Google).
- Mobile-native application.
- Admin dashboard or user management interface.
- Cover letter templates or formatting options.
- Multi-language support.
- Video upload or user-generated content in Learning Hub.
- Video commenting or rating features.
- Learning Hub content curation or moderation tools.
- Certificate or completion tracking for Learning Hub.
- Offline video playback.
- Video download functionality.
- Prorated refunds or partial billing adjustments for cancelled subscriptions.
- Email notifications for cancellation or reinstatement actions.
- Cancellation reason collection or feedback forms.
- Manual cancellation of background generation jobs.
- Real-time progress updates during generation (e.g., percentage complete).
- Personalised CV templates or formatting options.
- Editing or refining personalised CVs after generation.
- History page for personalised CVs (separate from cover letters).