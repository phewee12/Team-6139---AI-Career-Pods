# Release Notes v1.0.0

**Release Date:** April 28, 2026  
**Project:** Qwyse - AI Career Pods Platform  
**Release Type:** First Production Release

## New Features

### 1. Authentication & User Management

#### Email/Password Registration
Users can create accounts with email and password. Passwords are hashed using bcrypt (12 rounds). JWT tokens are issued upon successful registration and stored in HTTP-only cookies.

#### Google OAuth Integration
Alternative authentication using Google accounts. Requires Google Cloud Console configuration.

#### Profile Setup
Users provide career stage, field of study, and target timeline. This information personalizes group recommendations.

#### Avatar Upload
Profile pictures can be uploaded (PNG, JPEG, WEBP, GIF, max 2MB) or linked via URL.

### 2. Pod (Group) System

#### Public Pod Discovery
Browse and search public groups with filters for category, size, and activity level.

#### Private Pod Creation
Create invitation-only groups. Join requests require admin approval.

#### Role-Based Permissions
- **Owner:** Full control, can delete pod and manage admins
- **Admin:** Approve members, moderate posts, edit settings
- **Member:** View content, create posts, participate

#### Membership Management
Admins can review pending join requests and promote members to admin.

#### Onboarding Flow
New members acknowledge 5 pod rules and write an introduction before participating.

### 3. Resume Review System

#### Create Review Requests
Users upload PDF resumes (max 10MB) and provide context for reviewers.

#### Structured Feedback Rubric
Four scoring categories on 1-5 scale:
- Overall Score
- Impact & Results
- Role Fit
- ATS Clarity

#### AI-Powered Assistance
Google Gemini generates:
- ATS score (0-100)
- Suggested strengths
- Improvement areas
- Feedback summary

#### Secure PDF Access
Files stored privately in Supabase. Signed URLs expire after 10 minutes.

#### Request Lifecycle
Status flows: OPEN → CLOSED (requester or admin can close)

### 4. Accountability System

#### Nudge Templates
Pre-written messages for common scenarios:
- Goals check-in: "Hey {name}, haven't seen your goals this week"
- Missed check-in: "We missed you at check-in"
- Interview practice: "Want us to save a spot in interview practice?"

#### Custom Nudges
Users can write personalized messages (max 280 characters).

#### Quick Replies
Four response options:
- "Doing okay, just busy!"
- "Could use some support"
- "I'll catch up this weekend"
- "Can we chat?"

#### Quiet Mode
Pause incoming nudges. Optional expiration date. Pod sees announcement when enabled.

#### Private Scorecard
Users see only their own nudges sent/received counts (monthly). No public leaderboards.

### 5. Bi-Weekly Rituals

#### Phase Automation
Automated transitions between:
- Monday Set (goal planning)
- Wednesday Check (mid-week progress)
- Friday Reflect (week reflection)
- Weekend Break (rest period)

#### Check-Ins
Document accomplishments and set next-period goals. One per bi-weekly period.

#### Reflections
Weekly reflection on challenges and learnings. Phase-specific prompts.

#### Celebrations
Share wins with the pod. Title and optional description.

#### AI Summaries
Gemini generates summaries with three sections:
- Momentum Snapshot (3-5 sentences)
- Wins (bullet list, max 5)
- Focus Next (bullet list, max 4)

### 6. Engagement Scoring System

#### Weighted Metrics
| Activity | Weight |
|----------|--------|
| Messages | 15% |
| Goals Completed | 20% |
| Applications | 15% |
| Check-ins | 15% |
| Reflections | 10% |
| Celebrations | 5% |
| Resume Reviews | 10% |
| Nudges | 10% |

#### Scoring Levels
- **LOW (0-33):** "Getting Started"
- **MEDIUM (34-66):** "Active Contributor"
- **HIGH (67-100):** "Power User"

#### Trend Tracking
- UP (↑) - Score increased
- DOWN (↓) - Score decreased
- STABLE (→) - No change

#### Pod Averages
Compare individual scores against pod average.

### 7. Group Feed & Posts

- Create text posts (max 2000 characters)
- Delete own posts; admins can delete any post
- Author avatars and timestamps
- Optimistic UI updates

### 8. Notification System

**Notification Types:**
- Phase change reminders
- New member joins
- Celebrations
- Nudges received and replied
- Resume review feedback

**Features:**
- Read/unread tracking
- 30-second polling interval
- No email notifications in v1.0 (planned for v1.2)


## Bug Fixes

| ID | Description | Severity | Resolution |
|----|-------------|----------|------------|
| BUG-001 | Avatar upload failed for images >2MB | Medium | Added 2MB file size validation |
| BUG-002 | Session cookie not persisting across restarts | High | Set cookie maxAge to 7 days |
| BUG-003 | Resume feedback showed "No feedback" despite having data | High | Fixed data precedence in frontend |
| BUG-004 | Nudge eligibility not showing for all members | Medium | Implemented mergeServerEligibility function |
| BUG-005 | PDF upload failing with empty Base64 | High | Added validation for empty files |
| BUG-006 | Quiet mode announcement shown when disabled | Low | Fixed conditional rendering |
| BUG-007 | Summary generation failing for windows without posts | Medium | Added hasSummarySourceContent guard |
| BUG-008 | CORS errors in production | High | Dynamic origin based on NODE_ENV |
| BUG-009 | Google OAuth callback hanging | Medium | Added proper redirect handling |
| BUG-010 | Engagement trend showing wrong direction | Low | Fixed previous week comparison logic |
| BUG-011 | Nudge quick reply not updating UI immediately | Medium | Added local storage fallback |
| BUG-012 | Resume signed URL expired too quickly | Medium | Increased to 10 minutes (was 60 seconds) |


## Known Issues

### Unresolved Bugs

| ID | Description | Severity | Workaround |
|----|-------------|----------|------------|
| BUG-101 | Notification dropdown closes on mobile when clicking inside | Low | Refresh page or use desktop view |
| BUG-102 | AI summary fails with content >8000 tokens | Medium | Split activity across multiple periods |
| BUG-103 | Member count doesn't update immediately after join | Low | Refresh the page |
| BUG-104 | Nudge history shows placeholder for deleted users | Low | Don't delete users with activity |
| BUG-105 | PDF preview fails for encrypted PDFs | Medium | User must provide unencrypted PDF |

### Missing Functionality

| Feature | Planned Version | Priority |
|---------|----------------|----------|
| LinkedIn OAuth | v1.1 | Medium |
| Email notifications | v1.2 | High |
| Resume versioning | v1.3 | Low |
| Template library | v1.2 | Medium |
| Admin analytics dashboard | v1.1 | High |
| Mobile app | v2.0 | Low |
| Calendar integration | v1.3 | Medium |
| Export summaries | v1.2 | Low |
| Anonymous nudges | v1.3 | Low |
| Team/Enterprise pods | v1.4 | Low |
| WebSocket notifications | v1.2 | Medium |
| Rate limiting | v1.1 | High |

## Upgrade Notes

**This is the first release. No upgrade path from previous versions.**

### Initial Setup Requirements

- **Database migrations:** Yes - run `cd backend && npx prisma migrate deploy`
- **Configuration:** Create `.env` files in backend/ and frontend/
- **Storage:** Create `resume-uploads` bucket in Supabase (private)
- **API keys required:** Gemini API, Supabase URL + key
- **Disk space:** ~500MB for dependencies

## Compatibility

### Software Requirements

| Software | Minimum Version |
|----------|----------------|
| Node.js | 20.x LTS |
| npm | 9.x |
| PostgreSQL | 14 (or Supabase) |
| Git | 2.x |

### Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |
| iOS Safari | 14+ |
| Chrome Mobile | 90+ |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | April 28, 2026 | Initial production release |
