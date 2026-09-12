import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';

export async function initDB() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database,
  });

  // Table 1: Contact Messages
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'New',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table 2: Admin Users
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table 3: Package Tracking Records
  await db.exec(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      location TEXT NOT NULL,
      estimated_delivery TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed Default Admin User if missing
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@uscourier.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';
  const existingAdmin = await db.get('SELECT * FROM admins WHERE email = ?', [adminEmail]);

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPass, 10);
    await db.run('INSERT INTO admins (email, password) VALUES (?, ?)', [adminEmail, hashedPassword]);
    console.log(`Default admin account initialized: ${adminEmail}`);
  }

  // Seed Demo Shipment Record
  await db.run(`
    INSERT OR IGNORE INTO shipments (tracking_number, status, location, estimated_delivery)
    VALUES ('USC-317-0093710', 'In Transit', 'Central Sorting Facility', '2 Business Days')
  `);

  return db;
}
