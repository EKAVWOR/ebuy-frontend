// src/controllers/studentRegistryController.js (COMPLETE UPDATE)

const xlsx = require('xlsx');
const StudentRegistry = require('../models/StudentRegistry');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Upload student registry from Excel
// @route   POST /api/sug/student-registry/upload
// @access  Private (SUG/Admin)
exports.uploadStudentRegistry = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload an Excel file', 400);
    }

    // Read Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return errorResponse(res, 'Excel file is empty', 400);
    }

    console.log('📊 Processing', data.length, 'student records...');

    // Validate and prepare data
    const students = [];
    const errors = [];

    data.forEach((row, index) => {
      const rowNum = index + 2; // Excel row number (header is row 1)

      // Validate required fields
      if (!row.matricNumber || !row.fullname || !row.department || !row.faculty || !row.level) {
        errors.push(`Row ${rowNum}: Missing required fields (matricNumber, fullname, department, faculty, level)`);
        return;
      }

      // Validate level
      const level = parseInt(row.level);
      if (![100, 200, 300, 400, 500, 600].includes(level)) {
        errors.push(`Row ${rowNum}: Invalid level (${row.level}). Must be 100, 200, 300, 400, 500, or 600`);
        return;
      }

      students.push({
        matricNumber: String(row.matricNumber).trim().toUpperCase(),
        fullname: String(row.fullname).trim(),
        department: String(row.department).trim(),
        faculty: String(row.faculty).trim(),
        level: level,
        sessionYear: row.sessionYear?.trim() || new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
        status: 'active'
      });
    });

    if (errors.length > 0) {
      return errorResponse(res, 'Validation errors found', 400, errors);
    }

    // Insert students in batches
    let imported = 0;
    let duplicates = 0;
    let failed = 0;

    const batchSize = 100;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      
      try {
        await StudentRegistry.insertMany(batch, { ordered: false });
        imported += batch.length;
        console.log(`✅ Imported batch ${Math.floor(i / batchSize) + 1}: ${batch.length} students`);
      } catch (error) {
        // Handle duplicate key errors
        if (error.code === 11000) {
          const duplicateCount = error.writeErrors?.length || 0;
          imported += batch.length - duplicateCount;
          duplicates += duplicateCount;
          console.log(`⚠️  Batch ${Math.floor(i / batchSize) + 1}: ${duplicateCount} duplicates skipped`);
        } else {
          failed += batch.length;
          console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
        }
      }
    }

    successResponse(res, {
      message: 'Student registry uploaded successfully',
      data: {
        total: data.length,
        imported,
        duplicates,
        failed,
        errors: errors.length > 0 ? errors : undefined
      }
    }, 201);

  } catch (error) {
    console.error('Upload error:', error);
    errorResponse(res, error.message || 'Upload failed', 500);
  }
};

// @desc    Get all students in registry
// @route   GET /api/sug/student-registry
// @access  Private (SUG/Admin)
exports.getStudentRegistry = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, faculty, department, level, status } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { matricNumber: { $regex: search, $options: 'i' } },
        { fullname: { $regex: search, $options: 'i' } }
      ];
    }

    if (faculty) query.faculty = faculty;
    if (department) query.department = department;
    if (level) query.level = parseInt(level);
    if (status) query.status = status;

    const students = await StudentRegistry.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await StudentRegistry.countDocuments(query);

    // Get statistics
    const stats = await StudentRegistry.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          },
          byFaculty: {
            $push: {
              faculty: '$faculty',
              count: 1
            }
          }
        }
      }
    ]);

    const statusCounts = await StudentRegistry.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const facultyCounts = await StudentRegistry.aggregate([
      { $group: { _id: '$faculty', count: { $sum: 1 } } }
    ]);

    successResponse(res, {
      message: 'Student registry retrieved',
      data: {
        students,
        statistics: {
          total,
          byStatus: statusCounts,
          byFaculty: facultyCounts
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get registry error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Add single student manually
// @route   POST /api/sug/student-registry
// @access  Private (SUG/Admin)
exports.addStudent = async (req, res) => {
  try {
    const { matricNumber, fullname, department, faculty, level, sessionYear } = req.body;

    // Validate required fields
    if (!matricNumber || !fullname || !department || !faculty || !level) {
      return errorResponse(res, 'All fields are required', 400);
    }

    // Validate level
    if (![100, 200, 300, 400, 500, 600].includes(parseInt(level))) {
      return errorResponse(res, 'Invalid level. Must be 100, 200, 300, 400, 500, or 600', 400);
    }

    // Check if matric number already exists
    const existing = await StudentRegistry.findOne({ 
      matricNumber: matricNumber.toUpperCase().trim() 
    });

    if (existing) {
      return errorResponse(res, 'Matric number already exists in registry', 400);
    }

    const student = await StudentRegistry.create({
      matricNumber: matricNumber.toUpperCase().trim(),
      fullname: fullname.trim(),
      department: department.trim(),
      faculty: faculty.trim(),
      level: parseInt(level),
      sessionYear: sessionYear?.trim() || new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
      status: 'active'
    });

    successResponse(res, {
      message: 'Student added to registry successfully',
      data: { student }
    }, 201);

  } catch (error) {
    console.error('Add student error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Update student record
// @route   PUT /api/sug/student-registry/:id
// @access  Private (SUG/Admin)
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, department, faculty, level, sessionYear, status } = req.body;

    const student = await StudentRegistry.findById(id);

    if (!student) {
      return errorResponse(res, 'Student not found in registry', 404);
    }

    // Update fields
    if (fullname) student.fullname = fullname.trim();
    if (department) student.department = department.trim();
    if (faculty) student.faculty = faculty.trim();
    if (level) {
      const levelNum = parseInt(level);
      if (![100, 200, 300, 400, 500, 600].includes(levelNum)) {
        return errorResponse(res, 'Invalid level', 400);
      }
      student.level = levelNum;
    }
    if (sessionYear) student.sessionYear = sessionYear.trim();
    if (status) {
      if (!['active', 'graduated', 'suspended'].includes(status)) {
        return errorResponse(res, 'Invalid status', 400);
      }
      student.status = status;
    }

    await student.save();

    successResponse(res, {
      message: 'Student record updated successfully',
      data: { student }
    });

  } catch (error) {
    console.error('Update student error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Delete student from registry
// @route   DELETE /api/sug/student-registry/:id
// @access  Private (SUG/Admin)
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await StudentRegistry.findById(id);

    if (!student) {
      return errorResponse(res, 'Student not found in registry', 404);
    }

    // Check if student has already registered as user
    const registeredUser = await User.findOne({ 
      matricNumber: student.matricNumber 
    });

    if (registeredUser) {
      return errorResponse(
        res, 
        'Cannot delete: Student has already registered on the platform. Please suspend the user account instead.',
        400
      );
    }

    await student.deleteOne();

    successResponse(res, {
      message: 'Student deleted from registry successfully'
    });

  } catch (error) {
    console.error('Delete student error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Bulk update student status
// @route   PUT /api/sug/student-registry/bulk-update
// @access  Private (SUG/Admin)
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { studentIds, status } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return errorResponse(res, 'Student IDs array is required', 400);
    }

    if (!['active', 'graduated', 'suspended'].includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }

    const result = await StudentRegistry.updateMany(
      { _id: { $in: studentIds } },
      { $set: { status } }
    );

    successResponse(res, {
      message: `${result.modifiedCount} student(s) updated successfully`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Download registry template
// @route   GET /api/sug/student-registry/template
// @access  Private (SUG/Admin)
exports.downloadTemplate = async (req, res) => {
  try {
    const template = [
      {
        matricNumber: 'CS/2020/001',
        fullname: 'John Doe',
        department: 'Computer Science',
        faculty: 'Science',
        level: 400,
        sessionYear: '2023/2024'
      },
      {
        matricNumber: 'ENG/2021/050',
        fullname: 'Jane Smith',
        department: 'Electrical Engineering',
        faculty: 'Engineering',
        level: 300,
        sessionYear: '2023/2024'
      },
      {
        matricNumber: 'MED/2019/010',
        fullname: 'David Brown',
        department: 'Medicine and Surgery',
        faculty: 'Medicine',
        level: 500,
        sessionYear: '2023/2024'
      }
    ];

    const ws = xlsx.utils.json_to_sheet(template);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // matricNumber
      { wch: 25 }, // fullname
      { wch: 25 }, // department
      { wch: 20 }, // faculty
      { wch: 8 },  // level
      { wch: 12 }  // sessionYear
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=student_registry_template.xlsx');
    res.send(buffer);

  } catch (error) {
    console.error('Template download error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Export student registry to Excel
// @route   GET /api/sug/student-registry/export
// @access  Private (SUG/Admin)
exports.exportRegistry = async (req, res) => {
  try {
    const { faculty, department, level, status } = req.query;

    let query = {};
    if (faculty) query.faculty = faculty;
    if (department) query.department = department;
    if (level) query.level = parseInt(level);
    if (status) query.status = status;

    const students = await StudentRegistry.find(query)
      .select('matricNumber fullname department faculty level sessionYear status')
      .sort({ faculty: 1, department: 1, matricNumber: 1 })
      .lean();

    if (students.length === 0) {
      return errorResponse(res, 'No students found to export', 404);
    }

    // Format data for Excel
    const excelData = students.map(student => ({
      'Matric Number': student.matricNumber,
      'Full Name': student.fullname,
      'Department': student.department,
      'Faculty': student.faculty,
      'Level': student.level,
      'Session': student.sessionYear,
      'Status': student.status
    }));

    const ws = xlsx.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 }
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Student Registry');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `student_registry_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Get registry statistics
// @route   GET /api/sug/student-registry/statistics
// @access  Private (SUG/Admin)
exports.getRegistryStatistics = async (req, res) => {
  try {
    const totalStudents = await StudentRegistry.countDocuments();
    
    const byStatus = await StudentRegistry.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const byFaculty = await StudentRegistry.aggregate([
      { $group: { _id: '$faculty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byLevel = await StudentRegistry.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const byDepartment = await StudentRegistry.aggregate([
      { $group: { _id: { faculty: '$faculty', department: '$department' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const registeredUsers = await User.countDocuments({ role: 'student' });

    successResponse(res, {
      message: 'Registry statistics retrieved',
      data: {
        totalStudents,
        registeredUsers,
        registrationRate: totalStudents > 0 ? ((registeredUsers / totalStudents) * 100).toFixed(2) + '%' : '0%',
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byFaculty,
        byLevel,
        topDepartments: byDepartment
      }
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Search students for verification
// @route   GET /api/sug/student-registry/search
// @access  Private (SUG/Admin)
exports.searchStudent = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 3) {
      return errorResponse(res, 'Search query must be at least 3 characters', 400);
    }

    const students = await StudentRegistry.find({
      $or: [
        { matricNumber: { $regex: query, $options: 'i' } },
        { fullname: { $regex: query, $options: 'i' } }
      ],
      status: 'active'
    })
    .limit(20)
    .select('matricNumber fullname department faculty level status');

    successResponse(res, {
      message: 'Search results',
      data: {
        students,
        count: students.length
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    errorResponse(res, error.message, 500);
  }
};