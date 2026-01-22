import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileId: {
    type: String,
    sparse: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'uploading', 'uploaded', 'error'],
    default: 'pending',
    index: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true,
    default: 'text/plain'
  },
  uploadedAt: {
    type: Date
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Методы модели
fileSchema.methods.markAsUploading = function() {
  this.status = 'uploading';
  return this.save();
};

fileSchema.methods.markAsUploaded = function(fileId) {
  this.status = 'uploaded';
  this.fileId = fileId;
  this.uploadedAt = new Date();
  this.errorMessage = undefined;
  return this.save();
};

fileSchema.methods.markAsError = function(errorMessage) {
  this.status = 'error';
  this.errorMessage = errorMessage;
  return this.save();
};

fileSchema.methods.markAsPending = function() {
  this.status = 'pending';
  this.fileId = undefined;
  this.uploadedAt = undefined;
  this.errorMessage = undefined;
  return this.save();
};

export const File = mongoose.model('File', fileSchema);
