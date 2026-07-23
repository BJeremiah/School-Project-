require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  const password = 'Teacher123!';
  const hash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, name, email, role`,
    ['Ama Mensah', 'teacher@testschool.com', hash, 'teacher']
  );

  const teacher = result.rows[0];
  console.log('Seeded user:', teacher);
  console.log('Login with password:', password);

  const existingClass = await pool.query(
    'SELECT id, class_name FROM classes WHERE teacher_id = $1',
    [teacher.id]
  );

  let classRow;
  if (existingClass.rows.length > 0) {
    classRow = existingClass.rows[0];
    console.log('Teacher already has a class:', classRow);
  } else {
    const classResult = await pool.query(
      `INSERT INTO classes (class_name, teacher_id)
       VALUES ($1, $2)
       RETURNING id, class_name`,
      ['Primary 3B', teacher.id]
    );
    classRow = classResult.rows[0];
    console.log('Seeded class:', classRow);
  }

  const directorHash = await bcrypt.hash('Director123!', 10);
  const directorResult = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, name, email, role`,
    ['Mr. Kwabena Owusu', 'director@testschool.com', directorHash, 'director']
  );
  console.log('Seeded director:', directorResult.rows[0]);
  console.log('Director login password: Director123!');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
