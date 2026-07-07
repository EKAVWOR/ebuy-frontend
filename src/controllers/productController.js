// src/controllers/productController.js

const Product = require('../models/Product');
const Store = require('../models/Store');
const uploadService = require('../services/uploadService');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Vendor)
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      subCategory,
      price,
      comparePrice,
      costPrice,
      stock,
      sku,
      tags,
      specifications
    } = req.body;

    // Get vendor's store
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return errorResponse(res, 'You must create a store first', 400);
    }

    if (!store.isApproved || store.status !== 'active') {
      return errorResponse(res, 'Your store must be approved to add products', 403);
    }

    // Handle image uploads
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await uploadService.uploadImage(file, 'products');
        imageUrls.push(uploadResult.secure_url);
      }
    }

    // Create product
    const product = await Product.create({
      storeId: store._id,
      vendorId: req.user.id,
      name,
      description,
      category,
      subCategory,
      price,
      comparePrice,
      costPrice,
      images: imageUrls,
      stock,
      sku,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [],
      specifications: specifications ? JSON.parse(specifications) : [],
      status: stock > 0 ? 'active' : 'out_of_stock'
    });

    // Update store metrics
    store.metrics.totalProducts += 1;
    await store.save();

    successResponse(res, {
      message: 'Product created successfully',
      data: { product }
    }, 201);

  } catch (error) {
    console.error('Create product error:', error);
    errorResponse(res, error.message || 'Failed to create product', 500);
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort,
      storeId
    } = req.query;

    let query = { status: 'active' };

    // Filters
    if (category) {
      query.category = category;
    }

    if (storeId) {
      query.storeId = storeId;
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'popular') sortOption = { 'metrics.sales': -1 };
    if (sort === 'rating') sortOption = { 'metrics.rating': -1 };

    const products = await Product.find(query)
      .populate('storeId', 'storeName logo')
      .populate('vendorId', 'fullname')
      .sort(sortOption)
      .limit(limit)
      .skip(skip);

    const total = await Product.countDocuments(query);

    successResponse(res, {
      message: 'Products retrieved successfully',
      data: {
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
    console.error('Get products error:', error);
    errorResponse(res, error.message || 'Failed to get products', 500);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('storeId', 'storeName logo banner description')
      .populate('vendorId', 'fullname email');

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Increment views
    product.metrics.views += 1;
    await product.save();

    successResponse(res, {
      message: 'Product retrieved successfully',
      data: { product }
    });

  } catch (error) {
    console.error('Get product error:', error);
    errorResponse(res, error.message || 'Failed to get product', 500);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Vendor)
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      subCategory,
      price,
      comparePrice,
      costPrice,
      stock,
      tags,
      specifications,
      status
    } = req.body;

    let product = await Product.findById(req.params.id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      // Delete old images
      for (const oldImage of product.images) {
        await uploadService.deleteImage(oldImage);
      }

      // Upload new images
      let imageUrls = [];
      for (const file of req.files) {
        const uploadResult = await uploadService.uploadImage(file, 'products');
        imageUrls.push(uploadResult.secure_url);
      }
      product.images = imageUrls;
    }

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    if (subCategory) product.subCategory = subCategory;
    if (price) product.price = price;
    if (comparePrice) product.comparePrice = comparePrice;
    if (costPrice) product.costPrice = costPrice;
    if (stock !== undefined) product.stock = stock;
    if (tags) product.tags = Array.isArray(tags) ? tags : tags.split(',');
    if (specifications) product.specifications = JSON.parse(specifications);
    if (status) product.status = status;

    await product.save();

    successResponse(res, {
      message: 'Product updated successfully',
      data: { product }
    });

  } catch (error) {
    console.error('Update product error:', error);
    errorResponse(res, error.message || 'Failed to update product', 500);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Vendor)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Delete product images
    for (const image of product.images) {
      await uploadService.deleteImage(image);
    }

    await product.deleteOne();

    // Update store metrics
    await Store.findByIdAndUpdate(product.storeId, {
      $inc: { 'metrics.totalProducts': -1 }
    });

    successResponse(res, {
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    errorResponse(res, error.message || 'Failed to delete product', 500);
  }
};

// @desc    Get vendor products
// @route   GET /api/products/vendor/my-products
// @access  Private (Vendor)
exports.getVendorProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const { status, search } = req.query;

    let query = { vendorId: req.user.id };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .populate('storeId', 'storeName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Product.countDocuments(query);

    // Get statistics
    const stats = await Product.aggregate([
      { $match: { vendorId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statistics = {
      total: 0,
      active: 0,
      draft: 0,
      out_of_stock: 0
    };

    stats.forEach(stat => {
      statistics[stat._id] = stat.count;
      statistics.total += stat.count;
    });

    successResponse(res, {
      message: 'Products retrieved successfully',
      data: {
        products,
        statistics,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get vendor products error:', error);
    errorResponse(res, error.message || 'Failed to get products', 500);
  }
};