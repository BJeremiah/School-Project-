const pool = require('../config/db');

const DEFAULT_SUBJECTS = [
  'Mathematics',
  'English',
  'Science',
  'French',
  'Computing',
  'Ghanaian Language',
  'History',
  'Physical Education',
  'Our World Our People',
  'Creative Arts',
  'Religious and Moral Education',
];

async function getTeacherClassId(userId) {
  const result = await pool.query('SELECT id FROM classes WHERE teacher_id = $1', [userId]);
  return result.rows.length ? result.rows[0].id : null;
}

async function resolveClassId(req) {
  // Locked to the account's own assigned class -- a classId from the
  // request is never trusted, since each class belongs to exactly one
  // teacher account (enforced at login).
  return getTeacherClassId(req.user.userId);
}

// New model: Class Score = SBA + Group Research + Practical Tasks + Projects (each /25, sums to /100),
// halved to /50. Exam entered /100, halved to /50. Total = Class Score + Exam, out of 100.
function computeTotals(row) {
  const sba = row.sba_score !== null ? Number(row.sba_score) : 0;
  const research = row.group_research !== null ? Number(row.group_research) : 0;
  const practical = row.practical_tasks !== null ? Number(row.practical_tasks) : 0;
  const projects = row.projects !== null ? Number(row.projects) : 0;
  const exam = row.exam_score !== null ? Number(row.exam_score) : null;

  const hasAnyClassEntry =
    row.sba_score !== null || row.group_research !== null || row.practical_tasks !== null || row.projects !== null;

  const classRaw = sba + research + practical + projects; // out of 100
  const classScore = hasAnyClassEntry ? classRaw / 2 : null; // out of 50
  const examConverted = exam !== null ? exam / 2 : null; // out of 50

  const hasAnyEntry = hasAnyClassEntry || exam !== null;
  const total = hasAnyEntry ? (classScore || 0) + (examConverted || 0) : null;

  return {
    class_score: classScore !== null ? Math.round(classScore * 100) / 100 : null,
    exam_converted: examConverted !== null ? Math.round(examConverted * 100) / 100 : null,
    total: total !== null ? Math.round(total * 100) / 100 : null,
  };
}

function gradeFor(total) {
  if (total === null) return null;
  if (total >= 80) return 'Excellent';
  if (total >= 70) return 'Very Good';
  if (total >= 65) return 'Good';
  if (total >= 60) return 'High Credit';
  if (total >= 55) return 'Credit';
  if (total >= 50) return 'Satisfactory';
  if (total >= 45) return 'Adequate';
  if (total >= 35) return 'Minimally Adequate';
  return 'Well Below Average';
}

// GET /api/assessment/subjects — list subjects for the selected class (seeds defaults on first use)
async function listSubjects(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const existing = await pool.query('SELECT id, name FROM subjects WHERE class_id = $1 ORDER BY name', [classId]);

    if (existing.rows.length === 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const name of DEFAULT_SUBJECTS) {
          await client.query(
            `INSERT INTO subjects (class_id, name) VALUES ($1, $2) ON CONFLICT (class_id, name) DO NOTHING`,
            [classId, name]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      const seeded = await pool.query('SELECT id, name FROM subjects WHERE class_id = $1 ORDER BY name', [classId]);
      return res.json({ subjects: seeded.rows });
    }

    res.json({ subjects: existing.rows });
  } catch (err) {
    console.error('listSubjects error:', err);
    res.status(500).json({ error: 'Failed to load subjects.' });
  }
}

// POST /api/assessment/subjects — add a custom subject
async function addSubject(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Subject name is required.' });
  }

  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const result = await pool.query(
      `INSERT INTO subjects (class_id, name) VALUES ($1, $2) RETURNING id, name`,
      [classId, name.trim()]
    );
    res.status(201).json({ subject: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This subject already exists for this class.' });
    }
    console.error('addSubject error:', err);
    res.status(500).json({ error: 'Failed to add subject.' });
  }
}

// DELETE /api/assessment/subjects/:id — remove a subject from the selected class
async function removeSubject(req, res) {
  const { id } = req.params;
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const result = await pool.query(
      'DELETE FROM subjects WHERE id = $1 AND class_id = $2 RETURNING id',
      [id, classId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found in this class.' });
    }
    res.json({ message: 'Subject removed.' });
  } catch (err) {
    console.error('removeSubject error:', err);
    res.status(500).json({ error: 'Failed to remove subject.' });
  }
}

// GET /api/assessment/subject/:subjectId/scores — roster + entered scores + computed totals, ranked
async function getSubjectScores(req, res) {
  const { subjectId } = req.params;

  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const subjectResult = await pool.query(
      'SELECT id, name FROM subjects WHERE id = $1 AND class_id = $2',
      [subjectId, classId]
    );
    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found in this class.' });
    }

    const rowsResult = await pool.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name,
              a.sba_score, a.group_research, a.practical_tasks, a.projects, a.exam_score
       FROM students s
       LEFT JOIN assessment_scores a ON a.student_id = s.id AND a.subject_id = $1
       WHERE s.class_id = $2 AND s.status = 'active'
       ORDER BY s.last_name, s.first_name`,
      [subjectId, classId]
    );

    const withTotals = rowsResult.rows.map((r) => ({
      student_id: r.student_id,
      first_name: r.first_name,
      last_name: r.last_name,
      sba_score: r.sba_score !== null ? Number(r.sba_score) : null,
      group_research: r.group_research !== null ? Number(r.group_research) : null,
      practical_tasks: r.practical_tasks !== null ? Number(r.practical_tasks) : null,
      projects: r.projects !== null ? Number(r.projects) : null,
      exam_score: r.exam_score !== null ? Number(r.exam_score) : null,
      ...computeTotals(r),
    }));

    const withGrade = withTotals.map((r) => ({ ...r, grade: gradeFor(r.total) }));

    const ranked = withGrade
      .filter((r) => r.total !== null)
      .sort((a, b) => b.total - a.total);

    let position = 0;
    let prevTotal = null;
    let skip = 0;
    const positionMap = {};
    ranked.forEach((r) => {
      if (r.total !== prevTotal) {
        position += 1 + skip;
        skip = 0;
      } else {
        skip += 1;
      }
      positionMap[r.student_id] = position;
      prevTotal = r.total;
    });

    const studentsWithPosition = withGrade.map((r) => ({
      ...r,
      position: positionMap[r.student_id] || null,
    }));

    res.json({ subject: subjectResult.rows[0], students: studentsWithPosition });
  } catch (err) {
    console.error('getSubjectScores error:', err);
    res.status(500).json({ error: 'Failed to load scores.' });
  }
}

// POST /api/assessment/subject/:subjectId/scores — bulk save/update scores for this subject.
async function saveSubjectScores(req, res) {
  const { subjectId } = req.params;
  const { scores } = req.body;

  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    return res.status(400).json({ error: 'scores object is required.' });
  }

  const client = await pool.connect();
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const subjectResult = await pool.query(
      'SELECT id FROM subjects WHERE id = $1 AND class_id = $2',
      [subjectId, classId]
    );
    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found in this class.' });
    }

    const studentIds = Object.keys(scores);
    if (studentIds.length === 0) {
      return res.status(400).json({ error: 'At least one student score is required.' });
    }

    const validStudents = await client.query(
      `SELECT id FROM students WHERE class_id = $1 AND id = ANY($2::uuid[])`,
      [classId, studentIds]
    );
    if (validStudents.rows.length !== studentIds.length) {
      return res.status(400).json({ error: 'One or more students do not belong to this class.' });
    }

    await client.query('BEGIN');

    for (const studentId of studentIds) {
      const s = scores[studentId] || {};

      const existingResult = await client.query(
        `SELECT sba_score, group_research, practical_tasks, projects, exam_score
         FROM assessment_scores WHERE subject_id = $1 AND student_id = $2`,
        [subjectId, studentId]
      );
      const existing = existingResult.rows[0] || {};

      const pick = (field) => (s[field] !== undefined ? s[field] : existing[field] !== undefined ? existing[field] : null);

      const sba = pick('sba_score');
      const research = pick('group_research');
      const practical = pick('practical_tasks');
      const projects = pick('projects');
      const exam = pick('exam_score');

      await client.query(
        `INSERT INTO assessment_scores (subject_id, student_id, sba_score, group_research, practical_tasks, projects, exam_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (subject_id, student_id)
         DO UPDATE SET sba_score = $3, group_research = $4, practical_tasks = $5, projects = $6, exam_score = $7, updated_at = now()`,
        [subjectId, studentId, sba, research, practical, projects, exam]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Scores saved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23514') {
      return res.status(400).json({ error: 'One or more scores are out of the allowed range.' });
    }
    console.error('saveSubjectScores error:', err);
    res.status(500).json({ error: 'Failed to save scores.' });
  } finally {
    client.release();
  }
}

// GET /api/assessment/rankings — overall ranking: sum of totals across all subjects with entries
async function getOverallRankings(req, res) {
  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const rowsResult = await pool.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name,
              a.sba_score, a.group_research, a.practical_tasks, a.projects, a.exam_score
       FROM students s
       LEFT JOIN assessment_scores a ON a.student_id = s.id
       WHERE s.class_id = $1 AND s.status = 'active'`,
      [classId]
    );

    const studentTotals = {};
    rowsResult.rows.forEach((r) => {
      if (!studentTotals[r.student_id]) {
        studentTotals[r.student_id] = {
          student_id: r.student_id,
          first_name: r.first_name,
          last_name: r.last_name,
          overall_total: 0,
          subjects_counted: 0,
        };
      }
      const totals = computeTotals(r);
      if (totals.total !== null) {
        studentTotals[r.student_id].overall_total += totals.total;
        studentTotals[r.student_id].subjects_counted += 1;
      }
    });

    const list = Object.values(studentTotals)
      .filter((s) => s.subjects_counted > 0)
      .map((s) => ({ ...s, overall_total: Math.round(s.overall_total * 100) / 100 }))
      .sort((a, b) => b.overall_total - a.overall_total);

    let position = 0;
    let prevTotal = null;
    let skip = 0;
    list.forEach((s) => {
      if (s.overall_total !== prevTotal) {
        position += 1 + skip;
        skip = 0;
      } else {
        skip += 1;
      }
      s.position = position;
      prevTotal = s.overall_total;
    });

    res.json({ rankings: list });
  } catch (err) {
    console.error('getOverallRankings error:', err);
    res.status(500).json({ error: 'Failed to load rankings.' });
  }
}

module.exports = {
  listSubjects,
  addSubject,
  removeSubject,
  getSubjectScores,
  saveSubjectScores,
  getOverallRankings,
};