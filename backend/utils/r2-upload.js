const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Important for R2 compatibility
});

/**
 * Generate a pre-signed URL for uploading a file to R2
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<{uploadUrl: string, publicUrl: string, key: string}>}
 */
async function generateUploadUrl(filename, contentType) {
  try {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME is not set in environment variables');
    }

    // Sanitize the filename to create a safe key
    const fileExtension = filename.split('.').pop();
    const fileNameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const sanitizedFilenameBase = fileNameWithoutExtension
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-');
    const finalFilename = `${sanitizedFilenameBase}.${fileExtension}`;

    // Create a unique key for the file in the bucket (use ic-chips folder)
    const key = `ic-chips/${Date.now()}-${finalFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    // Generate the pre-signed URL which is valid for 10 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

    // The public URL of the file after upload
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return { uploadUrl, publicUrl, key };
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw error;
  }
}

/**
 * Upload a file buffer directly to R2
 * @param {Buffer} fileBuffer - File data as buffer
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<{publicUrl: string, key: string}>}
 */
async function uploadFileToR2(fileBuffer, filename, contentType) {
  try {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME is not set in environment variables');
    }

    // Sanitize the filename to create a safe key
    const fileExtension = filename.split('.').pop();
    const fileNameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const sanitizedFilenameBase = fileNameWithoutExtension
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-');
    const finalFilename = `${sanitizedFilenameBase}.${fileExtension}`;

    // Create a unique key for the file in the bucket (use ic-chips folder)
    const key = `ic-chips/${Date.now()}-${finalFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // The public URL of the file after upload
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return { publicUrl, key };
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    throw error;
  }
}

module.exports = {
  generateUploadUrl,
  uploadFileToR2,
  s3Client,
};
