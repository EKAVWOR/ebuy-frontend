// src/controllers/sugController.js

const User = require('../models/User');
const Store = require('../models/Store');
const Order = require('../models/Order');
const SugCommission = require('../models/SugCommission');
const StudentRegistry = require('../models/StudentRegistry');
const commissionService = require('../services/commissionService');
const { successResponse, errorResponse } = require('../utils/responses');
const fs = require('fs');
const csv = require('csv-parser');

// ==================== DASHBOARD ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student', verified: true });
    const totalVendors = await User.countDocuments({ role: 'vendor' });
    const activeVendors = await User.countDocuments({ role: 'vendor', status: 'active' });
    const pendingVendors = await User.countDocuments({ role: 'vendor', status: 'pending' });
    const totalOrders = await Order.countDocuments({ paymentStatus: 'paid' });
    const registrySize = await StudentRegistry.countDocuments();

    // Store stats
    const totalStores = await Store.countDocuments();
    const pendingStores = await Store.countDocuments({ isApproved: false, status: 'pending' });
    const activeStores = await Store.countDocuments({ isApproved: true, status: 'active' });

    const earningsSummary = await commissionService.getSugEarnings(req.user.id);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyEarnings = await commissionService.getSugEarnings(
      req.user.id, startOfMonth, new Date()
    );

    const recentTransactions = await SugCommission.find({ sugId: req.user.id })
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(10);

    successResponse(res, {
      message: 'Dashboard stats retrieved successfully',
      data: {
        statistics: {
          totalStudents,
          totalVendors,
          activeVendors,
          pendingVendors,
          totalOrders,
          registrySize,
          totalStores,
          pendingStores,
          activeStores,
          totalEarnings: earningsSummary.totalEarnings,
          monthlyEarnings: monthlyEarnings.totalEarnings
        },
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Get SUG dashboard error:', error);
    errorResponse(res, error.message || 'Failed to get dashboard stats', 500);
  }
};

// ==================== USER MANAGEMENT ====================

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role = '', status = '', verified = '', search = '' } = req.query;

    const query = {};
    if (role && ['student', 'vendor'].includes(role)) {
      query.role = role;
    } else {
      query.role = { $in: ['student', 'vendor'] };
    }

    if (status) query.status = status;
    if (verified !== '') query.verified = verified === 'true';

    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { matricNumber: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalVendors = await User.countDocuments({ role: 'vendor' });
    const pendingVendors = await User.countDocuments({ role: 'vendor', status: 'pending' });
    const activeVendors = await User.countDocuments({ role: 'vendor', status: 'active' });

    successResponse(res, {
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit)
        },
        counts: { totalStudents, totalVendors, pendingVendors, activeVendors }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    errorResponse(res, error.message || 'Failed to get users', 500);
  }
};

exports.getPendingVendors = async (req, res) => {
  try {
    const pendingVendors = await User.find({
      role: 'vendor',
      $or: [{ status: 'pending' }, { verified: false }]
    })
      .sort({ createdAt: -1 })
      .select('-password');

    successResponse(res, {
      message: 'Pending vendors retrieved successfully',
      data: {
        vendors: pendingVendors,
        count: pendingVendors.length
      }
    });
  } catch (error) {
    console.error('Get pending vendors error:', error);
    errorResponse(res, error.message || 'Failed to get pending vendors', 500);
  }
};

exports.approveVendor = async (req, res) => {
  try {
    const { userId } = req.params;
    const { approved, notes } = req.body;

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, 'User not found', 404);
    if (user.role !== 'vendor') return errorResponse(res, 'User is not a vendor', 400);

    if (approved) {
      user.verified = true;
      user.status = 'active';
    } else {
      user.verified = false;
      user.status = 'suspended';
    }

    await user.save();

    successResponse(res, {
      message: `Vendor ${approved ? 'approved' : 'rejected'} successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('Approve vendor error:', error);
    errorResponse(res, error.message || 'Failed to approve vendor', 500);
  }
};

exports.verifyStudent = async (req, res) => {
  try {
    const { userId } = req.params;
    const { verified } = req.body;

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, 'User not found', 404);
    if (user.role !== 'student') return errorResponse(res, 'User is not a student', 400);

    user.verified = verified;
    user.status = verified ? 'active' : 'pending';
    await user.save();

    successResponse(res, {
      message: `Student ${verified ? 'verified' : 'unverified'} successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('Verify student error:', error);
    errorResponse(res, error.message || 'Failed to verify student', 500);
  }
};

// ==================== STORE MANAGEMENT ====================

// @desc    Get all stores with filters
// @route   GET /api/sug/stores
// @access  Private (SUG)
exports.getAllStores = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, isApproved, search } = req.query;

    let query = {};

    if (status) query.status = status;

    if (isApproved !== undefined && isApproved !== '') {
      query.isApproved = isApproved === 'true';
    }

    if (search) {
      query.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const stores = await Store.find(query)
      .populate('owner', 'fullname email phone businessName')
      .populate('approvedBy', 'fullname')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Store.countDocuments(query);

    // Counts for stats/tabs
    const pendingCount = await Store.countDocuments({ isApproved: false, status: 'pending' });
    const activeCount = await Store.countDocuments({ isApproved: true, status: 'active' });
    const suspendedCount = await Store.countDocuments({ status: 'suspended' });
    const totalCount = await Store.countDocuments();

    successResponse(res, {
      message: 'Stores retrieved successfully',
      data: {
        stores,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        counts: {
          pending: pendingCount,
          active: activeCount,
          suspended: suspendedCount,
          total: totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get stores error:', error);
    errorResponse(res, error.message || 'Failed to get stores', 500);
  }
};

// @desc    Get pending stores
// @route   GET /api/sug/pending-stores
// @access  Private (SUG)
exports.getPendingStores = async (req, res) => {
  try {
    const stores = await Store.find({
      isApproved: false,
      status: 'pending'
    })
      .populate('owner', 'fullname email phone businessName')
      .sort({ createdAt: -1 });

    successResponse(res, {
      message: 'Pending stores retrieved successfully',
      data: {
        stores,
        count: stores.length
      }
    });
  } catch (error) {
    console.error('Get pending stores error:', error);
    errorResponse(res, error.message || 'Failed to get pending stores', 500);
  }
};

// @desc    Get single store details
// @route   GET /api/sug/stores/:storeId
// @access  Private (SUG)
exports.getStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId)
      .populate('owner', 'fullname email phone businessName department faculty')
      .populate('approvedBy', 'fullname');

    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }

    successResponse(res, {
      message: 'Store retrieved successfully',
      data: { store }
    });
  } catch (error) {
    console.error('Get store details error:', error);
    errorResponse(res, error.message || 'Failed to get store', 500);
  }
};

// @desc    Approve or reject store
// @route   PUT /api/sug/stores/:storeId/approve
// @access  Private (SUG)
exports.approveStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { approved, notes } = req.body;

    const store = await Store.findById(storeId);
    if (!store) return errorResponse(res, 'Store not found', 404);

    if (approved) {
      store.isApproved = true;
      store.status = 'active';
      store.approvedBy = req.user.id;
      store.approvedAt = new Date();
    } else {
      store.isApproved = false;
      store.status = 'suspended';
    }

    await store.save();

    successResponse(res, {
      message: `Store ${approved ? 'approved' : 'rejected'} successfully`,
      data: { store }
    });
  } catch (error) {
    console.error('Approve store error:', error);
    errorResponse(res, error.message || 'Failed to update store', 500);
  }
};

// @desc    Update store status (suspend/reactivate)
// @route   PUT /api/sug/stores/:storeId/status
// @access  Private (SUG)
exports.updateStoreStatus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended', 'pending'].includes(status)) {
      return errorResponse(res, 'Invalid status value', 400);
    }

    const store = await Store.findById(storeId);
    if (!store) return errorResponse(res, 'Store not found', 404);

    store.status = status;

    // If reactivating a suspended store, ensure it stays approved
    if (status === 'active' && !store.isApproved) {
      store.isApproved = true;
      store.approvedBy = req.user.id;
      store.approvedAt = new Date();
    }

    await store.save();

    successResponse(res, {
      message: `Store status updated to ${status}`,
      data: { store }
    });
  } catch (error) {
    console.error('Update store status error:', error);
    errorResponse(res, error.message || 'Failed to update store status', 500);
  }
};

// ==================== STUDENT REGISTRY ====================

exports.getStudentRegistry = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = '', faculty = '',
      department = '', level = '', status = ''
    } = req.query;

    const query = {};
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
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await StudentRegistry.countDocuments(query);

    successResponse(res, {
      message: 'Student registry retrieved successfully',
      data: {
        students,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get student registry error:', error);
    errorResponse(res, error.message || 'Failed to get registry', 500);
  }
};

exports.addStudentToRegistry = async (req, res) => {
  try {
    const { matricNumber, fullname, department, faculty, level, sessionYear, email, phone } = req.body;

    if (!matricNumber || !fullname || !department || !faculty || !level) {
      return errorResponse(res, 'Matric, name, department, faculty & level are required', 400);
    }

    const normalizedMatric = matricNumber.toUpperCase().trim();

    const existing = await StudentRegistry.findOne({ matricNumber: normalizedMatric });
    if (existing) return errorResponse(res, 'Matric number already exists in registry', 400);

    const currentYear = new Date().getFullYear();
    const defaultSessionYear = `${currentYear}/${currentYear + 1}`;

    const student = await StudentRegistry.create({
      matricNumber: normalizedMatric,
      fullname: fullname.trim(),
      department: department.trim(),
      faculty: faculty.trim(),
      level: parseInt(level),
      sessionYear: sessionYear || defaultSessionYear,
      email: email ? email.toLowerCase().trim() : undefined,
      phone: phone ? phone.trim() : undefined,
      addedBy: req.user.id,
      status: 'active'
    });

    successResponse(res, {
      message: 'Student added to registry successfully',
      data: { student }
    }, 201);
  } catch (error) {
    console.error('Add student error:', error);
    errorResponse(res, error.message || 'Failed to add student', 500);
  }
};

exports.bulkAddStudents = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Please upload a CSV file', 400);

    const students = [];
    const errors = [];
    let rowNumber = 0;

    const currentYear = new Date().getFullYear();
    const defaultSessionYear = `${currentYear}/${currentYear + 1}`;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        rowNumber++;
        if (!row.matricNumber || !row.fullname || !row.department) {
          errors.push({ row: rowNumber, error: 'Missing required fields' });
          return;
        }
        students.push({
          matricNumber: row.matricNumber.toUpperCase().trim(),
          fullname: row.fullname.trim(),
          department: row.department.trim(),
          faculty: row.faculty?.trim() || 'N/A',
          level: parseInt(row.level?.trim() || '100'),
          sessionYear: row.sessionYear?.trim() || defaultSessionYear,
          email: row.email?.toLowerCase().trim(),
          phone: row.phone?.trim(),
          addedBy: req.user.id,
          status: 'active'
        });
      })
      .on('end', async () => {
        try {
          fs.unlinkSync(req.file.path);
          let inserted = 0, duplicates = 0;
          for (const student of students) {
            try {
              await StudentRegistry.create(student);
              inserted++;
            } catch (err) {
              if (err.code === 11000) duplicates++;
              else errors.push({ matricNumber: student.matricNumber, error: err.message });
            }
          }
          successResponse(res, {
            message: 'Bulk upload completed',
            data: {
              totalRows: rowNumber,
              inserted,
              imported: inserted,
              duplicates,
              failed: errors.length,
              errorCount: errors.length,
              errors: errors.slice(0, 10)
            }
          });
        } catch (err) {
          errorResponse(res, err.message, 500);
        }
      })
      .on('error', (err) => {
        errorResponse(res, `CSV parsing error: ${err.message}`, 500);
      });
  } catch (error) {
    console.error('Bulk upload error:', error);
    errorResponse(res, error.message, 500);
  }
};

exports.getStudentRecord = async (req, res) => {
  try {
    const student = await StudentRegistry.findById(req.params.id)
      .populate('addedBy', 'fullname email');
    if (!student) return errorResponse(res, 'Student record not found', 404);
    successResponse(res, { message: 'Student retrieved', data: { student } });
  } catch (error) {
    console.error('Get student record error:', error);
    errorResponse(res, error.message, 500);
  }
};

exports.updateStudentRecord = async (req, res) => {
  try {
    const { fullname, department, faculty, level, sessionYear, email, phone, status } = req.body;
    const student = await StudentRegistry.findById(req.params.id);
    if (!student) return errorResponse(res, 'Student record not found', 404);

    if (fullname) student.fullname = fullname.trim();
    if (department) student.department = department.trim();
    if (faculty) student.faculty = faculty.trim();
    if (level) student.level = parseInt(level);
    if (sessionYear) student.sessionYear = sessionYear;
    if (email) student.email = email.toLowerCase().trim();
    if (phone) student.phone = phone.trim();
    if (status) student.status = status;

    await student.save();
    successResponse(res, { message: 'Student updated successfully', data: { student } });
  } catch (error) {
    console.error('Update student error:', error);
    errorResponse(res, error.message, 500);
  }
};

exports.deleteStudentRecord = async (req, res) => {
  try {
    const student = await StudentRegistry.findById(req.params.id);
    if (!student) return errorResponse(res, 'Student record not found', 404);
    if (student.isRegistered) return errorResponse(res, 'Cannot delete already registered student', 400);
    await student.deleteOne();
    successResponse(res, { message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    errorResponse(res, error.message, 500);
  }
};

exports.getRegistryStats = async (req, res) => {
  try {
    const totalStudents = await StudentRegistry.countDocuments();
    const activeStudents = await StudentRegistry.countDocuments({ status: 'active' });
    const graduatedStudents = await StudentRegistry.countDocuments({ status: 'graduated' });
    const suspendedStudents = await StudentRegistry.countDocuments({ status: 'suspended' });
    const registeredStudents = await StudentRegistry.countDocuments({ isRegistered: true });
    const pendingRegistration = totalStudents - registeredStudents;

    const registrationRate = totalStudents > 0
      ? `${((registeredStudents / totalStudents) * 100).toFixed(1)}%`
      : '0%';

    const byFaculty = await StudentRegistry.aggregate([
      { $group: { _id: '$faculty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byLevel = await StudentRegistry.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const byDepartment = await StudentRegistry.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    successResponse(res, {
      message: 'Statistics retrieved',
      data: {
        totalStudents,
        activeStudents,
        graduatedStudents,
        suspendedStudents,
        registeredUsers: registeredStudents,
        pendingRegistration,
        registrationRate,
        byStatus: {
          active: activeStudents,
          graduated: graduatedStudents,
          suspended: suspendedStudents
        },
        byFaculty,
        byLevel,
        byDepartment
      }
    });
  } catch (error) {
    console.error('Get registry stats error:', error);
    errorResponse(res, error.message, 500);
  }
};

// ==================== REPORTS ====================

exports.getCommissionEarnings = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const earnings = await commissionService.getSugEarnings(
      req.user.id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    const breakdown = await SugCommission.aggregate([
      {
        $match: {
          sugId: req.user._id,
          ...(startDate && endDate ? {
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
          } : {})
        }
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    successResponse(res, {
      message: 'Commission earnings retrieved successfully',
      data: { summary: earnings, breakdown }
    });
  } catch (error) {
    console.error('Get commission earnings error:', error);
    errorResponse(res, error.message || 'Failed to get earnings', 500);
  }
};

exports.getTransactionReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { startDate, endDate } = req.query;

    let query = { sugId: req.user.id };
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const transactions = await SugCommission.find(query)
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await SugCommission.countDocuments(query);

    successResponse(res, {
      message: 'Transaction reports retrieved successfully',
      data: {
        transactions,
        pagination: {
          page, limit, total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get transaction reports error:', error);
    errorResponse(res, error.message || 'Failed to get reports', 500);
  }
};