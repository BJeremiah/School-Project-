const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

async function getTeacherClassId(userId) {
  const result = await pool.query('SELECT id FROM classes WHERE teacher_id = $1', [userId]);
  return result.rows.length ? result.rows[0].id : null;
}

async function resolveClassId(req) {
  const explicitClassId = req.query.classId || req.body.classId;
  if (explicitClassId) {
    const check = await pool.query('SELECT id FROM classes WHERE id = $1', [explicitClassId]);
    return check.rows.length ? check.rows[0].id : null;
  }
  return getTeacherClassId(req.user.userId);
}

function computeTotals(row) {
  const sba = row.sba_score !== null ? Number(row.sba_score) : 0;
  const research = row.group_research !== null ? Number(row.group_research) : 0;
  const practical = row.practical_tasks !== null ? Number(row.practical_tasks) : 0;
  const projects = row.projects !== null ? Number(row.projects) : 0;
  const exam = row.exam_score !== null ? Number(row.exam_score) : null;

  const hasAnyClassEntry =
    row.sba_score !== null || row.group_research !== null || row.practical_tasks !== null || row.projects !== null;

  const classRaw = sba + research + practical + projects;
  const classScore = hasAnyClassEntry ? classRaw / 2 : null;
  const examConverted = exam !== null ? exam / 2 : null;

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

function rankByTotal(entries) {
  const ranked = entries.filter((e) => e.total !== null).sort((a, b) => b.total - a.total);
  let position = 0, prevTotal = null, skip = 0;
  const posMap = {};
  ranked.forEach((e) => {
    if (e.total !== prevTotal) { position += 1 + skip; skip = 0; } else { skip++; }
    posMap[e.student_id] = position;
    prevTotal = e.total;
  });
  return posMap;
}

// GET /api/reportcards/:studentId?term=...&year=...&classId=...
async function getReportCardRemarks(req, res) {
  const { studentId } = req.params;
  const { term, year } = req.query;
  if (!term || !year) return res.status(400).json({ error: 'term and year are required.' });

  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const studentCheck = await pool.query(
      `SELECT id FROM students WHERE id = $1 AND class_id = $2 AND status = 'active'`,
      [studentId, classId]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in this class.' });
    }

    const result = await pool.query(
      `SELECT * FROM report_card_remarks WHERE student_id = $1 AND term = $2 AND year = $3`,
      [studentId, term, year]
    );

    res.json({ remarks: result.rows[0] || null });
  } catch (err) {
    console.error('getReportCardRemarks error:', err);
    res.status(500).json({ error: 'Failed to load report card remarks.' });
  }
}

// POST /api/reportcards/:studentId — save/update remarks for a term
async function saveReportCardRemarks(req, res) {
  const { studentId } = req.params;
  const {
    term, year, next_term_begins,
    talent_and_interest, conduct, class_teacher_remarks, head_teacher_remarks,
    attendance_present, attendance_total,
  } = req.body;

  if (!term || !year) return res.status(400).json({ error: 'term and year are required.' });

  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const studentCheck = await pool.query(
      `SELECT id FROM students WHERE id = $1 AND class_id = $2 AND status = 'active'`,
      [studentId, classId]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in this class.' });
    }

    const result = await pool.query(
      `INSERT INTO report_card_remarks
         (student_id, class_id, term, year, next_term_begins, talent_and_interest, conduct,
          class_teacher_remarks, head_teacher_remarks, attendance_present, attendance_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (student_id, term, year)
       DO UPDATE SET
         next_term_begins = $5, talent_and_interest = $6, conduct = $7,
         class_teacher_remarks = $8, head_teacher_remarks = $9,
         attendance_present = $10, attendance_total = $11, updated_at = now()
       RETURNING *`,
      [
        studentId, classId, term, year, next_term_begins || null,
        talent_and_interest || null, conduct || null,
        class_teacher_remarks || null, head_teacher_remarks || null,
        attendance_present !== undefined ? attendance_present : null,
        attendance_total !== undefined ? attendance_total : null,
      ]
    );

    res.status(200).json({ remarks: result.rows[0] });
  } catch (err) {
    console.error('saveReportCardRemarks error:', err);
    res.status(500).json({ error: 'Failed to save report card remarks.' });
  }
}

// GET /api/reportcards/:studentId/pdf?term=...&year=...&classId=...
async function generateReportCardPdf(req, res) {
  const { studentId } = req.params;
  const { term, year } = req.query;
  if (!term || !year) return res.status(400).json({ error: 'term and year are required.' });

  try {
    const classId = await resolveClassId(req);
    if (!classId) return res.status(404).json({ error: 'No class assigned to this teacher.' });

    const studentResult = await pool.query(
      `SELECT s.first_name, s.last_name, s.photo_url, c.class_name
       FROM students s JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1 AND s.class_id = $2 AND s.status = 'active'`,
      [studentId, classId]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in this class.' });
    }
    const student = studentResult.rows[0];

    const remarksResult = await pool.query(
      `SELECT * FROM report_card_remarks WHERE student_id = $1 AND term = $2 AND year = $3`,
      [studentId, term, year]
    );
    const remarks = remarksResult.rows[0] || {};

    const subjectsResult = await pool.query('SELECT id, name FROM subjects WHERE class_id = $1 ORDER BY name', [classId]);
    const classStudentsResult = await pool.query(
      `SELECT id FROM students WHERE class_id = $1 AND status = 'active'`,
      [classId]
    );
    const classStudentIds = classStudentsResult.rows.map((r) => r.id);

    const allScoresResult = classStudentIds.length
      ? await pool.query(
          `SELECT a.subject_id, a.student_id, a.sba_score, a.group_research, a.practical_tasks, a.projects, a.exam_score
           FROM assessment_scores a
           WHERE a.subject_id = ANY($1::uuid[]) AND a.student_id = ANY($2::uuid[])`,
          [subjectsResult.rows.map((s) => s.id), classStudentIds]
        )
      : { rows: [] };

    const scoresBySubject = {};
    for (const row of allScoresResult.rows) {
      if (!scoresBySubject[row.subject_id]) scoresBySubject[row.subject_id] = [];
      scoresBySubject[row.subject_id].push(row);
    }

    const subjectRows = subjectsResult.rows.map((subject) => {
      const subjectScores = scoresBySubject[subject.id] || [];
      const scoreByStudent = {};
      subjectScores.forEach((r) => { scoreByStudent[r.student_id] = r; });

      const withTotals = classStudentIds.map((sid) => ({
        student_id: sid,
        ...computeTotals(scoreByStudent[sid] || {}),
      }));
      const posMap = rankByTotal(withTotals);
      const mine = withTotals.find((r) => r.student_id === studentId);

      return {
        name: subject.name,
        class_score: mine ? mine.class_score : null,
        exam_converted: mine ? mine.exam_converted : null,
        total: mine ? mine.total : null,
        grade: mine ? gradeFor(mine.total) : null,
        position: posMap[studentId] || null,
      };
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${student.first_name}_${student.last_name}_ReportCard.pdf"`);
    doc.pipe(res);

    if (student.photo_url) {
      const photoPath = path.join(__dirname, '..', student.photo_url.replace(/^\//, ''));
      if (fs.existsSync(photoPath)) {
        try {
          doc.image(photoPath, 460, 40, { width: 80, height: 80 });
        } catch (e) {
          // silent — PDF still generates without the photo if it fails to load
        }
      }
    }

    doc.fontSize(16).text('KWAO Educational Complex', 40, 40);
    doc.fontSize(10).text(`Student: ${student.first_name} ${student.last_name}`, 40, 65);
    doc.text(`Class: ${student.class_name}`, 40, 80);
    doc.text(`Term: ${term}     Year: ${year}`, 40, 95);
    doc.text(`Next Term Begins: ${remarks.next_term_begins ? new Date(remarks.next_term_begins).toLocaleDateString('en-GB') : '____________'}`, 40, 110);

    let y = 140;
    const colX = { subject: 40, sba: 220, exam: 270, total: 320, grade: 370, position: 420 };

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('SUBJECT', colX.subject, y);
    doc.text('SBA/50', colX.sba, y);
    doc.text('EXAM/50', colX.exam, y);
    doc.text('TOTAL/100', colX.total, y);
    doc.text('GRADE', colX.grade, y);
    doc.text('POS', colX.position, y);
    y += 15;
    doc.moveTo(40, y).lineTo(555, y).stroke();
    y += 5;

    doc.font('Helvetica').fontSize(9);
    subjectRows.forEach((row) => {
      doc.text(row.name, colX.subject, y, { width: 170 });
      doc.text(row.class_score !== null ? String(row.class_score) : '-', colX.sba, y);
      doc.text(row.exam_converted !== null ? String(row.exam_converted) : '-', colX.exam, y);
      doc.text(row.total !== null ? String(row.total) : '-', colX.total, y);
      doc.text(row.grade || '-', colX.grade, y);
      doc.text(row.position !== null ? String(row.position) : '-', colX.position, y);
      y += 18;
    });

    y += 10;
    doc.moveTo(40, y).lineTo(555, y).stroke();
    y += 15;

    doc.fontSize(9);
    const attPresent = remarks.attendance_present !== null && remarks.attendance_present !== undefined ? remarks.attendance_present : '____';
    const attTotal = remarks.attendance_total !== null && remarks.attendance_total !== undefined ? remarks.attendance_total : '____';
    doc.text(`Attendance: ${attPresent} out of total of ${attTotal}`, 40, y);
    y += 20;
    doc.text(`Talent and Interest: ${remarks.talent_and_interest || '____________________________________'}`, 40, y);
    y += 30;
    doc.text('Conduct: Comment on pupil\'s courtesy, emotional control, initiative, dependability and sense of co-operation', 40, y, { width: 515 });
    y += 15;
    doc.text(remarks.conduct || '____________________________________', 40, y, { width: 515 });
    y += 35;
    doc.text(`Class Teacher's Remarks and Signature: ${remarks.class_teacher_remarks || '____________________________________'}`, 40, y, { width: 515 });
    y += 35;
    doc.text(`Head Teacher's Remarks and Signature: ${remarks.head_teacher_remarks || '____________________________________'}`, 40, y, { width: 515 });

    doc.end();
  } catch (err) {
    console.error('generateReportCardPdf error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report card.' });
    }
  }
}

module.exports = {
  getReportCardRemarks,
  saveReportCardRemarks,
  generateReportCardPdf,
};