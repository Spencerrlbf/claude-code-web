# Transformer Talent Website - Frontend Redesign TODO

**Timeline:** 1 week
**Goal:** Build a professional recruitment platform homepage while keeping the AI Researcher Tool fully functional

---

## Project Structure

### Current State
```
app/
├── page.tsx              # AI Researcher Finder (DO NOT TOUCH - keep working)
├── api/
│   └── find-researchers/
│       └── route.ts      # API for researcher tool (DO NOT TOUCH)
└── layout.tsx
```

### Target State
```
app/
├── page.tsx                          # AI Researcher Finder (unchanged for now)
├── preview/
│   └── page.tsx                      # NEW HOMEPAGE PREVIEW (localhost:3000/preview)
├── jobs/
│   └── page.tsx                      # Jobs board (simple list)
├── api/
│   └── find-researchers/
│       └── route.ts                  # Unchanged
├── components/
│   ├── marketing/                    # Components for marketing pages
│   │   ├── Hero.tsx
│   │   ├── ValueProps.tsx
│   │   ├── TrustSignals.tsx
│   │   ├── ContactForm.tsx
│   │   └── Footer.tsx
│   └── ui/                          # Reusable UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Input.tsx
└── lib/
    └── data/
        └── jobs.ts                   # Job listings data
```

### Final State (After Approval)
```
app/
├── page.tsx                          # New homepage (replace current)
├── tools/
│   └── ai-researcher-finder/
│       └── page.tsx                  # Moved AI tool here
├── jobs/
│   └── page.tsx                      # Jobs board
└── [other files same as above]
```

---

## Phase 1: Setup shadcn/ui (Day 1 - 1 hour)

### ✅ Task 1.1: Install shadcn/ui - ✅ COMPLETE
**Goal:** Set up shadcn/ui for instant professional components

**Steps:**
- [x] Run `npx shadcn@latest init`
- [x] Configure with Tailwind CSS v4 (already installed)
- [x] Choose base color scheme (neutral for dark mode)
- [x] Install needed components:
  ```bash
  npx shadcn@latest add button card input textarea
  ```

**Why shadcn/ui:**
- ✅ Pre-built, accessible components
- ✅ Customizable with Tailwind
- ✅ Copy/paste, not a dependency
- ✅ Saves days of work

**Completed:** 2025-11-08
**Components installed:** button, card, input, textarea
**Test page:** `/preview` at localhost:3000/preview
**Build status:** ✅ Passing

---

### ✅ Task 1.2: Create Marketing Components
**Goal:** Build only the homepage-specific components (using shadcn/ui primitives)

**Components:**
- [ ] `components/marketing/Hero.tsx`
  - Uses shadcn Button component
  - Headline, subheadline, 2 CTAs
- [ ] `components/marketing/ValueProps.tsx`
  - Uses shadcn Card component
  - 3-column grid on desktop, stack on mobile
- [ ] `components/marketing/TrustSignals.tsx`
  - Simple logo grid with shadcn Card
- [ ] `components/marketing/ContactForm.tsx`
  - Uses shadcn Form, Input, Textarea components
- [ ] `components/marketing/Footer.tsx`
  - Simple footer, no special components needed

---

## Phase 2: New Homepage Preview (Days 3-4)

### ✅ Task 2.1: Create Preview Route
**Goal:** Build new homepage at `/preview` route

**File:** `app/preview/page.tsx`

**Sections to include:**
1. **Hero Section**
   - Headline: "Find Exceptional Talent for Your Most Critical Roles"
   - Subheadline: "AI-powered recruitment for deep-tech startups backed by Y Combinator, Sequoia, a16z, and more"
   - CTA 1: "Schedule a Call" → /contact or Calendly link
   - CTA 2: "Try Free AI Tool" → /tools/ai-researcher-finder (future route)

2. **Trust Signals**
   - VC logos: YC, Sequoia, a16z, General Catalyst, 8VC
   - Text: "Trusted by 50+ VC-backed startups"

3. **Value Propositions** (3 columns)
   - AI-Powered Matching
   - Deep-Tech Expertise
   - Quality Over Quantity

4. **How It Works** (5 steps)
   - Understand your needs
   - AI-powered sourcing
   - Hand-picked shortlist
   - Interviews & offers
   - Post-placement support

5. **Free Tools Preview**
   - Card for "AI Researcher Finder"
   - "Try it now" button → link to current app/page.tsx
   - Optional: placeholder cards for future tools

6. **Contact Form**
   - Embed ContactForm component
   - Or link to Calendly

7. **Footer**
   - Basic links, copyright

**Success criteria:**
- [ ] All sections responsive (mobile, tablet, desktop)
- [ ] Smooth animations on scroll
- [ ] Dark aesthetic matches current brand
- [ ] CTAs clearly visible
- [ ] Links to researcher tool work correctly

---

### ✅ Task 2.2: Assets & Content
**Goal:** Gather and prepare all content

**Assets needed:**
- [ ] VC logos (SVG preferred)
  - Y Combinator
  - Sequoia
  - Andreessen Horowitz (a16z)
  - General Catalyst
  - 8VC
- [ ] Icons for value props (use Lucide React or Heroicons)
- [ ] Optional: testimonial photos
- [ ] Optional: background graphics/patterns

**Copy to write:**
- [ ] Hero headline & subheadline
- [ ] Value prop descriptions (3x)
- [ ] How it works steps (5x)
- [ ] Footer text

---

## Phase 3: Jobs Board (Day 5)

### ✅ Task 3.1: Create Jobs Data Structure
**Goal:** Define job listing format

**File:** `lib/data/jobs.ts`

```typescript
export interface Job {
  id: string;
  title: string;
  company: string;          // or "Stealth Startup"
  location: string;         // "Remote", "SF", "NYC", etc.
  type: string;             // "Full-time", "Contract"
  description: string;
  requirements: string[];   // 3-5 bullet points
  salary?: string;          // "$150k-$200k" or undefined
  vcBacked?: string;        // "YC S23", "Sequoia", etc.
  applyUrl?: string;        // mailto or external link
  postedDate: string;       // ISO date string
}

export const jobs: Job[] = [
  // Add 10-15 jobs here
];
```

---

### ✅ Task 3.2: Build Jobs Page
**Goal:** Simple, clean job board

**File:** `app/jobs/page.tsx`

**Features:**
- [ ] Display all jobs as cards/list
- [ ] Show: title, company, location, 3 key requirements
- [ ] "Apply" button (mailto or external link)
- [ ] Optional: simple filter by location or role type
- [ ] Responsive design

**Nice-to-haves (if time):**
- [ ] Search bar
- [ ] Filter by VC-backed
- [ ] Sort by date

---

### ✅ Task 3.3: Add Jobs to Homepage
**Goal:** Surface jobs on the homepage

**Options:**
1. "Latest Opportunities" section showing 3-5 jobs
2. Just a "View All Jobs" CTA button linking to /jobs

Choose option based on time available.

---

## Phase 4: Polish & Deploy (Days 6-7)

### ✅ Task 4.1: Responsive Design
**Goal:** Works perfectly on all devices

**Test on:**
- [ ] Mobile (375px - iPhone)
- [ ] Tablet (768px - iPad)
- [ ] Desktop (1280px+)
- [ ] Large desktop (1920px+)

**Fix:**
- [ ] Typography scales appropriately
- [ ] Images don't break layout
- [ ] Forms are usable on mobile
- [ ] CTAs are thumb-friendly

---

### ✅ Task 4.2: Animations & Polish
**Goal:** Add subtle animations for professional feel

**Add:**
- [ ] Fade-in on scroll for sections
- [ ] Hover effects on cards and buttons
- [ ] Smooth transitions
- [ ] Loading states for contact form

**Libraries to consider:**
- Framer Motion (if you want advanced animations)
- Or just Tailwind transitions (simpler)

---

### ✅ Task 4.3: SEO Basics
**Goal:** Make the site discoverable

**Add to layout.tsx or page metadata:**
- [ ] Title: "Transformer Talent | AI-Powered Deep-Tech Recruitment"
- [ ] Description meta tag
- [ ] OG image (social sharing preview)
- [ ] Favicon (already exists)

---

### ✅ Task 4.4: Deploy Preview
**Goal:** Get it live for testing

**Steps:**
- [ ] Test locally on localhost:3000/preview
- [ ] Fix any bugs
- [ ] Deploy to Vercel
- [ ] Test on production URL
- [ ] Share with stakeholders for feedback

---

## Phase 5: Final Migration (After Approval)

### ✅ Task 5.1: Move Researcher Tool
**Goal:** Move AI tool to dedicated route

**Steps:**
- [ ] Create `app/tools/ai-researcher-finder/page.tsx`
- [ ] Copy current `app/page.tsx` content there
- [ ] Test tool works at new route
- [ ] Update any internal links

---

### ✅ Task 5.2: Replace Homepage
**Goal:** Make new homepage the default

**Steps:**
- [ ] Copy `app/preview/page.tsx` to `app/page.tsx`
- [ ] Update links to researcher tool (now at /tools/ai-researcher-finder)
- [ ] Delete `app/preview/page.tsx`
- [ ] Test all navigation works
- [ ] Deploy to production

---

## Optional Enhancements (If Time Allows)

### 🔄 Blog Setup
- [ ] Create `app/blog/page.tsx` (blog index)
- [ ] Create `app/blog/[slug]/page.tsx` (individual posts)
- [ ] Set up MDX for blog posts
- [ ] Write 2-3 initial articles:
  - "How to Hire ML Engineers in 2024"
  - "Top Interview Questions for AI Researchers"
  - "Salary Benchmarks for Deep-Tech Roles"

### 🔄 Email Capture
- [ ] Add email capture to AI tool ("Save results")
- [ ] Integrate with email service (Mailchimp, ConvertKit, etc.)
- [ ] Add to footer newsletter signup

### 🔄 Analytics
- [ ] Set up Google Analytics or Plausible
- [ ] Track CTA clicks
- [ ] Track tool usage
- [ ] Track job applications

### 🔄 Additional Tools
- [ ] Salary Benchmark Calculator
- [ ] Job Description Generator
- [ ] Create tools hub page at `/tools`

---

## Design Guidelines

### Color Palette
- **Primary:** #4F46E5 (Indigo) - CTAs, links
- **Secondary:** #06B6D4 (Cyan) - accents, highlights
- **Accent:** #F59E0B (Amber) - important CTAs
- **Dark BG:** #0F172A (Slate-900) - backgrounds
- **Light Text:** #F1F5F9 (Slate-100) - text on dark
- **Dark Text:** #1E293B (Slate-800) - text on light

### Typography
- **Font:** Inter (clean, professional, free)
- **Headlines:** 600-700 weight, larger sizes
- **Body:** 400 weight, 16px base
- **CTA Buttons:** 500-600 weight

### Spacing
- Use Tailwind's spacing scale consistently
- Sections: `py-16` or `py-20` on desktop
- Mobile: `py-8` or `py-12`

### Animations
- Keep subtle and performant
- Use `transition-all duration-300 ease-in-out`
- Hover states on interactive elements
- Optional: fade-in on scroll for sections

---

## Success Metrics

### Technical
- [ ] Lighthouse score > 90 (performance)
- [ ] No console errors
- [ ] Works on Chrome, Safari, Firefox
- [ ] Fast page load (< 2s)

### Business
- [ ] Clear value proposition visible in < 5 seconds
- [ ] At least 2 CTAs above the fold
- [ ] Contact form conversion-optimized
- [ ] Jobs board has 10+ active listings

---

## Notes

- **DO NOT TOUCH:** `app/page.tsx` and `app/api/find-researchers/route.ts` until Phase 5
- **Preview URL:** localhost:3000/preview during development
- **Iterative approach:** Build, test, get feedback, iterate
- **Mobile-first:** Design for mobile, enhance for desktop
- **Keep it simple:** Ship working > ship perfect

---

## Current Status

**Status:** 📋 Planning complete, ready to start
**Next task:** Task 1.1 - Create Component Library
**Blockers:** None
**Last updated:** 2025-11-08
