# Email Copy (Hybrid Tutoring SaaS)

Use these templates for transactional and lifecycle emails. Replace `{{placeholders}}` with real values in your email sender (e.g. Resend, SendGrid, or Paddle notifications).

---

## 1. Invite (Tutor or Student)

**Subject:** You're invited to join {{workspace_name}} on Edulabloom

**Body:**

Hi,

{{inviter_name}} has invited you to join **{{workspace_name}}** on Edulabloom — the platform that helps tutoring teams save time and deliver better results.

- **If you're a tutor:** You'll get access to AI content tools, assignments, quizzes, and your students.
- **If you're a student:** You'll be able to join classes, complete assignments, and use the Study Hub.

Accept your invite here:
{{invite_link}}

This link expires in 7 days. If you didn't expect this invite, you can ignore this email.

— The Edulabloom team

---

## 2. Welcome (post-signup, by account type)

### Business Owner

**Subject:** Welcome to Edulabloom — your tutoring business dashboard is ready

**Body:**

Hi {{first_name}},

Your workspace **{{workspace_name}}** is set up. You can now:

1. Invite tutors from your team
2. Invite students and assign them to tutors
3. View all classrooms, assignments, and quizzes in one place
4. Manage billing and plan from the Owner dashboard

Go to your dashboard: {{dashboard_link}}

Need help? Reply to this email or check our help center.

— The Edulabloom team

### Solo Tutor

**Subject:** Welcome to Edulabloom — start creating and teaching

**Body:**

Hi {{first_name}},

You're all set. Next steps:

1. Create your first classroom
2. Create classes and add students to them
3. Create assignments and quizzes — or use the AI Content Generator to create them in seconds

Open your Tutor dashboard: {{dashboard_link}}

— The Edulabloom team

### Student

**Subject:** Welcome to Edulabloom — your study hub is ready

**Body:**

Hi {{first_name}},

Your Edulabloom account is ready. You can:

- Use the **Study Hub** for AI-powered practice and summaries
- Take **Practice Tests** to quiz yourself
- Save materials in **My Library** and track **Progress**
- Join a class with a code from your tutor

Get started: {{dashboard_link}}

— The Edulabloom team

---

## 3. Assignment reminder (to student)

**Subject:** Reminder: {{assignment_title}} is due {{due_date}}

**Body:**

Hi {{first_name}},

This is a reminder that **{{assignment_title}}** ({{classroom_name}}) is due on **{{due_date}}**.

Submit your work here: {{assignment_link}}

— {{tutor_name}} via Edulabloom

---

## 4. Optional: Trial ending soon

**Subject:** Your Edulabloom trial ends in {{days_left}} days

**Body:**

Hi {{first_name}},

Your 14-day free trial ends on **{{trial_ends_date}}**. To keep full access to {{plan_name}}, choose a plan before then.

Manage your subscription: {{billing_link}}

— The Edulabloom team

---

## Placeholder reference

| Placeholder        | Example / description                    |
|--------------------|------------------------------------------|
| `workspace_name`   | "Smith Tutoring"                         |
| `inviter_name`     | "Jane Smith"                             |
| `invite_link`     | Full URL to accept invite                |
| `first_name`      | User's first name                        |
| `dashboard_link`  | e.g. https://app.edulabloom.com/dashboard/owner |
| `assignment_title`| "Chapter 5 Essay"                        |
| `due_date`         | "March 15, 2025"                         |
| `classroom_name`   | "English 101"                            |
| `assignment_link` | URL to assignment submission            |
| `tutor_name`       | Tutor display name                        |
| `days_left`        | 3                                        |
| `trial_ends_date`  | "March 10, 2025"                         |
| `plan_name`        | "Business Basic"                         |
| `billing_link`     | URL to billing page                      |
