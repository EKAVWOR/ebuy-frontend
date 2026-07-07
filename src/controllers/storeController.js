// src/controllers/storeController.js

const Store = require('../models/Store');
const Product = require('../models/Product');
const VendorWallet = require('../models/VendorWallet');
const uploadService = require('../services/uploadService');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Create new store
// @route   POST /api/stores
// @access  Private (Vendor)
exports.createStore = async (req, res) => {
  try {
    const { storeName, description, category, contactEmail, contactPhone, socialMedia } = req.body;

    // Check if vendor already has a store
    const existingStore = await Store.findOne({ owner: req.user.id });
    if (existingStore) {
      return errorResponse(res, 'You already have a store', 400);
    }

    // Check if store name is taken
    const storeNameExists = await Store.findOne({ 
      storeName: { $regex: new RegExp(`^${storeName}$`, 'i') }
    });
    if (storeNameExists) {
      return errorResponse(res, 'Store name already taken', 400);
    }

    // Create store
    const store = await Store.create({
      owner: req.user.id,
      storeName,
      description,
      category,
      contactEmail: contactEmail || req.user.email,
      contactPhone: contactPhone || req.user.phone,
      socialMedia,
      status: 'pending',
      isApproved: false
    });

    // Create vendor wallet
    await VendorWallet.create({
      vendorId: req.user.id,
      storeId: store._id
    });

    successResponse(res, {
      message: 'Store created successfully. Awaiting approval.',
      data: { store }
    }, 201);

  } catch (error) {
    console.error('Create store error:', error);
    errorResponse(res, error.message || 'Failed to create store', 500);
  }
};

// @desc    Get vendor's store
// @route   GET /api/stores/my/store
// @access  Private (Vendor)
exports.getMyStore = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id })
      .populate('owner', 'fullname email phone');

    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }

    successResponse(res, {
      message: 'Store retrieved successfully',
      data: { store }
    });

  } catch (error) {
    console.error('Get store error:', error);
    errorResponse(res, error.message || 'Failed to get store', 500);
  }
};

// @desc    Update store
// @route   PUT /api/stores/:id
// @access  Private (Vendor)
exports.updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, category, contactEmail, contactPhone, socialMedia } = req.body;

    let store = await Store.findById(id);

    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }

    // Check ownership
    if (store.owner.toString() !== req.user.id) {
      return errorResponse(res, 'Not authorized to update this store', 403);
    }

    // Handle file uploads
    if (req.file) {
      const fieldName = req.file.fieldname;
      const uploadResult = await uploadService.uploadImage(req.file, 'stores');
      
      if (fieldName === 'logo') {
        // Delete old logo if exists
        if (store.logo) {
          await uploadService.deleteImage(store.logo);
        }
        store.logo = uploadResult.secure_url;
      } else if (fieldName === 'banner') {
        // Delete old banner if exists
        if (store.banner) {
          await uploadService.deleteImage(store.banner);
        }
        store.banner = uploadResult.secure_url;
      }
    }

    // Update other fields
    if (description) store.description = description;
    if (category) store.category = category;
    if (contactEmail) store.contactEmail = contactEmail;
    if (contactPhone) store.contactPhone = contactPhone;
    if (socialMedia) store.socialMedia = socialMedia;

    await store.save();

    successResponse(res, {
      message: 'Store updated successfully',
      data: { store }
    });

  } catch (error) {
    console.error('Update store error:', error);
    errorResponse(res, error.message || 'Failed to update store', 500);
  }
};

// @desc    Get all stores
// @route   GET /api/stores
// @access  Public
exports.getAllStores = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const { category, search, status } = req.query;

    let query = { isApproved: true, status: 'active' };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && ['pending', 'active', 'suspended'].includes(status)) {
      query.status = status;
    }

    const stores = await Store.find(query)
      .populate('owner', 'fullname')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .select('-owner.password');

    const total = await Store.countDocuments(query);

    successResponse(res, {
      message: 'Stores retrieved successfully',
      data: {
        stores,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get stores error:', error);
    errorResponse(res, error.message || 'Failed to get stores', 500);
  }
};

// @desc    Get single store
// @route   GET /api/stores/:id
// @access  Public
exports.getStore = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate('owner', 'fullname email');

    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }

    // Get store metrics
    const productCount = await Product.countDocuments({ storeId: store._id });
    store.metrics.totalProducts = productCount;
    await store.save();

    successResponse(res, {
      message: 'Store retrieved successfully',
      data: { store }
    });

  } catch (error) {
    console.error('Get store error:', error);
    errorResponse(res, error.message || 'Failed to get store', 500);
  }
};

// @desc    Get store products
// @route   GET /api/stores/:id/products
// @access  Public
exports.getStoreProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const store = await Store.findById(id);
    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }

    const products = await Product.find({ storeId: id, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Product.countDocuments({ storeId: id, status: 'active' });

    successResponse(res, {
      message: 'Products retrieved successfully',
      data: {
        store: {
          id: store._id,
          name: store.storeName,
          logo: store.logo
        },
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get store products error:', error);
    errorResponse(res, error.message || 'Failed to get store products', 500);
  }
};