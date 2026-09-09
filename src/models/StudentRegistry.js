// src/models/StudentRegistry.js
const mongoose = require("mongoose");

const studentRegistrySchema = new mongoose.Schema(
  {
    matricNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    fullname: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    faculty: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      enum: [100, 200, 300, 400, 500, 600],
    },
    sessionYear: {
      type: String,
      required: true,
      default: function () {
        const year = new Date().getFullYear();
        return `${year}/${year + 1}`;
      },
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "graduated", "suspended"],
      default: "active",
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ Frontend alias (if UI uses fullName instead of fullname)
studentRegistrySchema.virtual("fullName").get(function () {
  return this.fullname;
});

// ✅ Expose id in JSON (keeps _id also)
studentRegistrySchema.virtual("id").get(function () {
  return this._id.toString();
});

// indexes
studentRegistrySchema.index({ faculty: 1, department: 1 });
studentRegistrySchema.index({ sessionYear: 1, level: 1 });

module.exports = mongoose.model("StudentRegistry", studentRegistrySchema);