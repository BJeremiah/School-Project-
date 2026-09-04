 School Management & Financial Tracker — Project Overview

*Last updated: 23 July 2026*

## 1. What This App Is

A full school management system being built for a real school, covering attendance, academic assessment, admissions, salaries, and school fees — with different portals for different staff roles.

**Roles in the system:**

| Role | Status | Purpose |
|---|---|---|
| **Teacher** | In progress | Attendance + Continuous Assessment for their own class |
| **Director** | Built (v1) | School-wide oversight dashboard |
| **Secretary** | Planned | Admissions + staff salaries |
| **Accountant** | Planned | School fees, arrears, canteen, bus fees |

> **Note:** The Director portal and the original Teacher fee-submission flow were built in an earlier version of the app, before the scope expanded to include Secretary and Accountant roles and a full per-student data model. The Teacher app is currently being rebuilt around individual student records instead of simple daily totals. The old fee-related tables (`daily_logs`, `daily_finances`) still exist in the database but are being phased out in favor of the Accountant section.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Teacher mobile app | React Native + Expo Go |
| Director web dashboard | React.js (Vite) |
| Backend API | Node.js + Express |
| Database | PostgreSQL (local dev) |
| Real-time updates | Socket.io |
| Auth | JWT (JSON Web Tokens) + bcrypt password hashing |

**Project folders (on your machine):**
- Backend: `D:\projects\school-app`
- Teacher mobile app: `D:\projects\teacher-mobile-app`
- Director web dashboard: `D:\projects\director-web-dashboard`

---

## 3. How to Run the App

Each part runs in its own Git Bash window and stays open while you use it.

```bash
# Window 1 — Backend (always needed)
cd /d/projects/school-app
node server.js

# Window 2 — Director Web Dashboard
cd /d/projects/director-web-dashboard
npm run dev
# then open http://localhost:5173 in your browser

# Window 3 — Teacher Mobile App (only when testing on phone)
cd /d/projects/teacher-mobile-app
npx expo start
# then scan the QR code with Expo Go on your phone
```

**Test accounts:**

| Role | Email | Password |
|---|---|---|
| Teacher (Ama Mensah, Primary 3B) | teacher@testschool.com | Teacher123! |
| Director (Mr. Kwabena Owusu) | director@testschool.com | Director123! |

---

## 4. Feature Status

### ✅ Teacher — Attendance (Built & Tested)
- Roster of real, individual students per class (name, gender, admission number)
- Daily present/absent marking, one tap per student
- Auto-calculated daily summary: boys present, girls present, total present, total absent, list of absentees
- **Weeks are tied to real calendar dates** — the system automatically groups Mon–Fri into a week; nothing to configure
- Weekly summaries calculated live from the saved daily records (nothing stored twice, so it can never drift out of sync)
- **Holiday button** — marks a single day as a non-school day, skipped from attendance counts
- **End-of-term button** — permanently locks attendance-taking for the class until reopened (separate from the holiday button)
- Add / remove students from the class roster
- Full history — any past day or week is fully accessible at any time

### ✅ Teacher — Continuous Assessment (Built & Tested)
- 11 default subjects, auto-created the first time a teacher opens the tab:
  Mathematics, English, Science, French, Computing, Ghanaian Language, History, Physical Education, Our World Our People, Creative Arts, Religious and Moral Education
- Teachers can add extra custom subjects, or leave any subject entirely unfilled
- Score entry per student, per subject:
  - Exercise: out of 10
  - Class Test 1: out of 15
  - Class Test 2: out of 15
  - **Class Score = sum of the three above, out of 40 (40%)**
  - Exam: entered out of 100, automatically converted → `(exam ÷ 100) × 60`
  - **Total = Class Score + Converted Exam, out of 100**
- Automatic ranking:
  - Per subject — only students with an entered score in that subject are ranked
  - Overall — sums each student's totals across every subject they have scores in, then ranks the whole class
  - Ties are handled correctly (e.g. two students tied for 1st both show position 1, and the next student is position 3, not 2)

### 🔲 Teacher — Records Tab (Not yet built)
- Tap into a single student → see their full attendance history and assessment performance in one place

### 🔲 Teacher Mobile App UI (Not yet rebuilt)
- The current mobile app still reflects the old fee-submission design
- Needs to be rebuilt with: Attendance tab, Continuous Assessment tab (subject-by-subject, like Excel sheets), Records tab, Add/Remove Student buttons

### ✅ Director Dashboard (Built, based on old fee-tracking model)
- Login, attendance %, revenue cards, 14-day trend chart, adjustable fee rates, live submission feed with anomaly detection, real-time updates via Socket.io
- **This will need to be updated** once the Teacher fee flow is fully replaced by the Accountant section, and expanded to show school-wide student, admissions, and salary data

### 🔲 Secretary Portal (Planned, not started)
- **Admissions tab:** admission form → student record; full admission list with male/female breakdown and counts
- **Salaries tab:** staff list with salary + account number, editable monthly, running total at the bottom that updates as salaries are edited
- Waiting on: Excel sheet of school data from you

### 🔲 Accountant Portal (Planned, not started)
- School fees, arrears, canteen fees, bus fees — per student
- Waiting on: Excel sheet of the fee structure from you

---

## 5. Database Tables (Current)

| Table | Purpose |
|---|---|
| `users` | All staff logins (teacher, director, and soon secretary/accountant), with role |
| `classes` | One class per teacher |
| `students` | Individual student records — name, gender, admission number, class, active/inactive status |
| `class_register_status` | Whether a class's register has been ended for the term |
| `attendance_days` | One row per class per calendar day (or holiday) |
| `attendance_records` | One row per student per attendance day (present/absent) |
| `subjects` | Assessment subjects per class (defaults + custom) |
| `assessment_scores` | One row per student per subject — exercise, 2 class tests, exam score |
| `daily_logs` / `daily_finances` | *Legacy* — old teacher fee-submission tables, being phased out |
| `fee_rates` | *Legacy* — canteen/bus rate config, will likely move to the Accountant portal |

---

## 6. Backend API Reference (Built So Far)

**Auth**
- `POST /api/auth/login`

**Students** *(teacher only)*
- `GET /api/students` — list active students in own class
- `POST /api/students` — add a student
- `DELETE /api/students/:id` — remove (soft-delete) a student

**Attendance** *(teacher only)*
- `GET /api/attendance/today` — today's roster + marks + register status
- `POST /api/attendance/today` — submit today's present/absent marks
- `POST /api/attendance/holiday` — mark today as a holiday
- `POST /api/attendance/end-term` — lock the register for the term
- `POST /api/attendance/reopen` — reopen the register
- `GET /api/attendance/day/:date` — full detail for a specific day
- `GET /api/attendance/weeks` — list of all weeks with recorded attendance
- `GET /api/attendance/week/:weekStart` — full breakdown for one week

**Continuous Assessment** *(teacher only)*
- `GET /api/assessment/subjects` — list subjects (auto-seeds defaults)
- `POST /api/assessment/subjects` — add a custom subject
- `DELETE /api/assessment/subjects/:id` — remove a subject
- `GET /api/assessment/subject/:subjectId/scores` — scores + totals + ranking for one subject
- `POST /api/assessment/subject/:subjectId/scores` — save/update scores for students
- `GET /api/assessment/rankings` — overall class ranking across all subjects

**Director Dashboard** *(director only, based on legacy fee model)*
- `GET /api/director/dashboard`
- `GET /api/director/rates`
- `PUT /api/director/rates`
- `DELETE /api/director/reports/:classId/today`

---

## 7. Next Steps

1. Finish testing the remaining attendance features (weekly view, holiday, end-of-term lock) end-to-end
2. Rebuild the Teacher mobile app UI around Attendance, Assessment, Records, and Add/Remove Student
3. Receive and process the school's Excel sheets (student list, fee structure) to seed real data
4. Build the Secretary portal (admissions + salaries)
5. Build the Accountant portal (fees, arrears, canteen, bus)
6. Update the Director dashboard to pull from the new student/attendance/assessment/admissions/salary data instead of the legacy fee tables
7. Eventually: real deployment (hosted database, hosted backend, hosted web dashboard, installable mobile app build) instead of running everything locally
