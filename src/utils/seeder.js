// src/utils/seeder.js

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('../models/User');
const StudentRegistry = require('../models/StudentRegistry');
const CommissionSetting = require('../models/CommissionSetting');
const connectDB = require('../config/database');

dotenv.config();

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('🌱 Seeding database...');

    // Clear existing data
    await User.deleteMany({ role: 'admin' });
    await CommissionSetting.deleteMany({});

    // Create Admin User
    const admin = await User.create({
      fullname: 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@ebuy.com',
      phone: '08012345678',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      role: 'admin',
      verified: true,
      status: 'active'
    });

    console.log('✅ Admin user created:', admin.email);

    // Create SUG Account
    const sug = await User.create({
      fullname: 'Student Union Government',
      email: 'sug@university.edu',
      phone: '08098765432',
      password: 'SUG@123456',
      role: 'sug',
      verified: true,
      status: 'active'
    });

    console.log('✅ SUG account created:', sug.email);

    // Create Default Commission Settings
    const commissionSetting = await CommissionSetting.create({
      vendorPercentage: 90,
      sugPercentage: 4,
      platformPercentage: 6,
      updatedBy: admin._id,
      isActive: true
    });

    console.log('✅ Commission settings created');

    // Create Sample Student Registry
    const sampleStudents = [
      {
        matricNumber: 'CS/2020/001',
        fullname: 'John Doe',
        department: 'Computer Science',
        faculty: 'Science',
        level: 400,
        sessionYear: '2023/2024',
        status: 'active'
      },
      {
        matricNumber: 'ENG/2021/050',
        fullname: 'Jane Smith',
        department: 'Electrical Engineering',
        faculty: 'Engineering',
        level: 300,
        sessionYear: '2023/2024',
        status: 'active'
      },
      {
        matricNumber: 'BIO/2022/100',
        fullname: 'Mike Johnson',
        department: 'Biology',
        faculty: 'Science',
        level: 200,
        sessionYear: '2023/2024',
        status: 'active'
      }
    ];

    await StudentRegistry.insertMany(sampleStudents);
    console.log('✅ Sample student registry created');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📝 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'Admin@123456'}`);
    console.log('\nSUG:');
    console.log(`  Email: ${sug.email}`);
    console.log('  Password: SUG@123456');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeder
seedDatabase();