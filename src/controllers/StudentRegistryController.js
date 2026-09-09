// src/controllers/studentRegistryController.js
const XLSX = require("xlsx");
const StudentRegistry = require("../models/StudentRegistry");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/responses");

const REQUIRED_FIELDS = ["matricNumber", "fullname", "department", "faculty", "level"];

function normalizeHeaderKey(key) {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Supports your preferred header names like "Matric Number", "Full Name", "Session Year"
const HEADER_ALIASES = {
  matricnumber: "matricNumber",
  matricno: "matricNumber",
  regno: "matricNumber",
  registrationnumber: "matricNumber",

  fullname: "fullname",
  fullnames: "fullname",
  studentname: "fullname",
  name: "fullname",
  full_name: "fullname",

  department: "department",
  dept: "department",

  faculty: "faculty",
  college: "faculty",

  level: "level",
  currentlevel: "level",

  sessionyear: "sessionYear",
  session: "sessionYear",
  academicyear: "sessionYear",

  email: "email",
  phone: "phone",
  status: "status",
};

function isRowEmpty(rowArr) {
  return (rowArr || []).every((cell) => String(cell ?? "").trim() === "");
}

function findHeaderRowIndex(aoa, scanRows = 15) {
  let bestIndex = -1;
  let bestScore = 0;

  const max = Math.min(scanRows, aoa.length);
  for (let i = 0; i < max; i++) {
    const row = aoa[i] || [];
    const tokens = row.map(normalizeHeaderKey);

    const canonicalFields = new Set(tokens.map((t) => HEADER_ALIASES[t]).filter(Boolean));

    let score = 0;
    for (const req of REQUIRED_FIELDS) if (canonicalFields.has(req)) score++;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 3 ? bestIndex : -1;
}

function buildRecordsFromSheet(sheet) {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!aoa.length) return { headerIndex: -1, records: [] };

  const headerIndex = findHeaderRowIndex(aoa);
  if (headerIndex === -1) return { headerIndex: -1, records: [] };

  const rawHeaders = (aoa[headerIndex] || []).map((h) => String(h ?? "").trim());
  const canonicalHeaders = rawHeaders
    .map(normalizeHeaderKey)
    .map((t) => HEADER_ALIASES[t] || null);

  const records = [];
  for (let i = headerIndex + 1; i < aoa.length; i++) {
    const rowArr = aoa[i] || [];
    if (isRowEmpty(rowArr)) continue;

    const obj = { __row: i + 1 };
    for (let c = 0; c < canonicalHeaders.length; c++) {
      const field = canonicalHeaders[c];
      if (!field) continue;

      const val = String(rowArr[c] ?? "").trim();
      if (val !== "") obj[field] = val;
    }
    records.push(obj);
  }

  return { headerIndex, records };
}

// ==================== UPLOAD ====================
// @route POST /api/sug/student-registry/upload
exports.uploadStudentRegistry = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return errorResponse(res, "Please upload an Excel/CSV file", 400);
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const { headerIndex, records } = buildRecordsFromSheet(sheet);
    if (headerIndex === -1) {
      return errorResponse(
        res,
        "Could not detect header row. Please use the template header: Matric Number, Full Name, Department, Faculty, Level, Session Year",
        400
      );
    }
    if (!records.length) {
      return errorResponse(res, "No data rows found in spreadsheet", 400);
    }

    const errors = [];
    const seen = new Set();

    const defaultSessionYear = (() => {
      const y = new Date().getFullYear();
      return `${y}/${y + 1}`;
    })();

    const cleaned = records.map((r) => {
      const rowNum = r.__row;
      delete r.__row;

      const matricNumber = String(r.matricNumber || "").trim().toUpperCase();
      const fullname = String(r.fullname || "").trim();
      const department = String(r.department || "").trim();
      const faculty = String(r.faculty || "").trim();
      const level = parseInt(String(r.level || "").trim(), 10);

      const missing = [];
      if (!matricNumber) missing.push("matricNumber");
      if (!fullname) missing.push("fullname");
      if (!department) missing.push("department");
      if (!faculty) missing.push("faculty");
      if (!Number.isFinite(level)) missing.push("level");

      if (missing.length) {
        errors.push(`Row ${rowNum}: Missing required fields (${missing.join(", ")})`);
      }

      if (Number.isFinite(level) && ![100, 200, 300, 400, 500, 600].includes(level)) {
        errors.push(`Row ${rowNum}: Invalid level (${r.level}). Must be 100,200,300,400,500,600`);
      }

      if (matricNumber) {
        if (seen.has(matricNumber)) errors.push(`Row ${rowNum}: Duplicate matric number (${matricNumber}) in file`);
        seen.add(matricNumber);
      }

      const sessionYear = String(r.sessionYear || "").trim();
      const email = String(r.email || "").trim().toLowerCase();
      const phone = String(r.phone || "").trim();
      const status = String(r.status || "").trim().toLowerCase();

      const set = { fullname, department, faculty, level };
      if (sessionYear) set.sessionYear = sessionYear;
      if (email) set.email = email;
      if (phone) set.phone = phone;
      if (["active", "graduated", "suspended"].includes(status)) set.status = status;

      return { matricNumber, set };
    });

    if (errors.length) return errorResponse(res, "Validation errors found", 400, errors);

    const ops = cleaned.map(({ matricNumber, set }) => ({
      updateOne: {
        filter: { matricNumber }, // ✅ normalized uppercase => matches existing
        update: {
          $set: set,
          $setOnInsert: {
            matricNumber,
            sessionYear: set.sessionYear || defaultSessionYear,
            status: set.status || "active",
            isRegistered: false,
            addedBy: req.user?._id,
          },
        },
        upsert: true,
      },
    }));

    const result = await StudentRegistry.bulkWrite(ops, { ordered: false });

    return successResponse(res, {
      message: "Student registry uploaded successfully",
      data: {
        upserted: result.upsertedCount || 0,
        modified: result.modifiedCount || 0,
        matched: result.matchedCount || 0,
      },
    });
  } catch (err) {
    return errorResponse(res, err.message || "Upload failed", 500);
  }
};

// ==================== LIST ====================
// @route GET /api/sug/student-registry
exports.getStudentRegistry = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
    const skip = (page - 1) * limit;

    const { search, faculty, department, level, status } = req.query;

    const query = {};
    if (faculty) query.faculty = String(faculty).trim();
    if (department) query.department = String(department).trim();
    if (level) query.level = parseInt(level, 10);
    if (status) query.status = String(status).trim();

    if (search) {
      const s = String(search).trim();
      query.$or = [
        { matricNumber: { $regex: s, $options: "i" } },
        { fullname: { $regex: s, $options: "i" } },
      ];
    }

    const [students, total] = await Promise.all([
      StudentRegistry.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StudentRegistry.countDocuments(query),
    ]);

    return successResponse(res, {
      message: "Student registry retrieved",
      data: {
        students,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// ==================== ADD SINGLE ====================
exports.addStudent = async (req, res) => {
  try {
    const { matricNumber, fullname, department, faculty, level, sessionYear } = req.body;

    if (!matricNumber || !fullname || !department || !faculty || !level) {
      return errorResponse(res, "All fields are required", 400);
    }

    const levelNum = parseInt(level, 10);
    if (![100, 200, 300, 400, 500, 600].includes(levelNum)) {
      return errorResponse(res, "Invalid level. Must be 100, 200, 300, 400, 500, or 600", 400);
    }

    const exists = await StudentRegistry.findOne({ matricNumber: String(matricNumber).trim().toUpperCase() });
    if (exists) return errorResponse(res, "Matric number already exists in registry", 400);

    const student = await StudentRegistry.create({
      matricNumber: String(matricNumber).trim().toUpperCase(),
      fullname: String(fullname).trim(),
      department: String(department).trim(),
      faculty: String(faculty).trim(),
      level: levelNum,
      sessionYear: sessionYear?.trim(),
      status: "active",
      addedBy: req.user?._id,
    });

    return successResponse(res, { message: "Student added successfully", data: { student } }, 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// ==================== UPDATE / DELETE ====================
exports.updateStudent = async (req, res) => {
  try {
    const updated = await StudentRegistry.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return errorResponse(res, "Student not found", 404);

    return successResponse(res, { message: "Student updated", data: { student: updated } });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await StudentRegistry.findById(req.params.id);
    if (!student) return errorResponse(res, "Student not found", 404);

    const registeredUser = await User.findOne({ matricNumber: student.matricNumber });
    if (registeredUser) {
      return errorResponse(
        res,
        "Cannot delete: Student has registered on the platform. Suspend instead.",
        400
      );
    }

    await student.deleteOne();
    return successResponse(res, { message: "Student deleted" });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// ==================== BULK UPDATE STATUS ====================
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const ids = req.body.ids || req.body.studentIds;
    const { status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, "Student IDs array is required", 400);
    }
    if (!["active", "graduated", "suspended"].includes(status)) {
      return errorResponse(res, "Invalid status", 400);
    }

    const result = await StudentRegistry.updateMany({ _id: { $in: ids } }, { $set: { status } });

    return successResponse(res, {
      message: `${result.modifiedCount} student(s) updated`,
      data: { matched: result.matchedCount, modified: result.modifiedCount },
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// ==================== TEMPLATE / EXPORT ====================
exports.downloadTemplate = async (req, res) => {
  try {
    const header = ["Matric Number", "Full Name", "Department", "Faculty", "Level", "Session Year", "Email", "Phone", "Status"];
    const example = ["CS/2020/001", "John Doe", "Computer Science", "Science", 400, "2026/2027", "john@school.edu", "08012345678", "active"];

    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws["!cols"] = [{ wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=student_registry_template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

exports.exportRegistry = async (req, res) => {
  try {
    const { faculty, department, level, status } = req.query;

    const query = {};
    if (faculty) query.faculty = String(faculty).trim();
    if (department) query.department = String(department).trim();
    if (level) query.level = parseInt(level, 10);
    if (status) query.status = String(status).trim();

    const students = await StudentRegistry.find(query)
      .select("matricNumber fullname department faculty level sessionYear email phone status")
      .sort({ faculty: 1, department: 1, matricNumber: 1 });

    if (!students.length) return errorResponse(res, "No students found to export", 404);

    const excelData = students.map((s) => ({
      "Matric Number": s.matricNumber,
      "Full Name": s.fullname,
      Department: s.department,
      Faculty: s.faculty,
      Level: s.level,
      "Session Year": s.sessionYear,
      Email: s.email || "",
      Phone: s.phone || "",
      Status: s.status,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student Registry");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename=student_registry_${new Date().toISOString().split("T")[0]}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// ==================== STATISTICS / SEARCH ====================
exports.getRegistryStatistics = async (req, res) => {
  try {
    const totalStudents = await StudentRegistry.countDocuments();
    const registeredUsers = await User.countDocuments({ role: "student" });

    const byStatus = await StudentRegistry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    const byFaculty = await StudentRegistry.aggregate([
      { $group: { _id: "$faculty", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const byLevel = await StudentRegistry.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return successResponse(res, {
      message: "Registry statistics retrieved",
      data: {
        totalStudents,
        registeredUsers,
        registrationRate: totalStudents > 0 ? ((registeredUsers / totalStudents) * 100).toFixed(2) + "%" : "0%",
        byStatus,
        byFaculty,
        byLevel,
      },
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

exports.searchStudent = async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || "").trim();
    if (!q || q.length < 3) return errorResponse(res, "Search query must be at least 3 characters", 400);

    const students = await StudentRegistry.find({
      $or: [
        { matricNumber: { $regex: q, $options: "i" } },
        { fullname: { $regex: q, $options: "i" } },
      ],
    })
      .limit(20)
      .select("matricNumber fullname department faculty level sessionYear status");

    return successResponse(res, { message: "Search results", data: { students, count: students.length } });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};