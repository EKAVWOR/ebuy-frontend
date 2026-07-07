// src/services/uploadService.js

const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

class UploadService {

  /**
   * Upload image to Cloudinary
   */
  async uploadImage(file, folder = 'general') {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `ebuy/${folder}`,
          resource_type: 'auto',
          transformation: [
            { width: 1000, height: 1000, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(files, folder = 'general') {
    try {
      const uploadPromises = files.map(file => this.uploadImage(file, folder));
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('Upload multiple images error:', error);
      throw new Error('Failed to upload images');
    }
  }

  /**
   * Delete image from Cloudinary
   */
  async deleteImage(imageUrl) {
    try {
      // Extract public_id from URL
      const parts = imageUrl.split('/');
      const fileWithExtension = parts[parts.length - 1];
      const publicId = `ebuy/${parts[parts.length - 2]}/${fileWithExtension.split('.')[0]}`;

      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (error) {
      console.error('Delete image error:', error);
      return false;
    }
  }

  /**
   * Delete multiple images
   */
  async deleteMultipleImages(imageUrls) {
    try {
      const deletePromises = imageUrls.map(url => this.deleteImage(url));
      await Promise.all(deletePromises);
      return true;
    } catch (error) {
      console.error('Delete multiple images error:', error);
      return false;
    }
  }
}

module.exports = new UploadService();