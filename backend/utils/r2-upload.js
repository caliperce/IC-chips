import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('=🔧 R2 Configuration:', {
  endpoint: process.env.R2_ENDPOINT,
  bucketName: process.env.R2_BUCKET_NAME,
  publicUrl: process.env.R2_PUBLIC_URL,
  hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY
});

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
 * @param {string} sessionId - Session ID to organize files by session
 * @returns {Promise<{uploadUrl: string, publicUrl: string, key: string}>}
 */
async function generateUploadUrl(filename, contentType, sessionId) {
  try {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME is not set in environment variables');
    }

    if (!sessionId) {
      throw new Error('sessionId is required for generating upload URL');
    }

    // Sanitize the filename to create a safe key
    const fileExtension = filename.split('.').pop();
    const fileNameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const sanitizedFilenameBase = fileNameWithoutExtension
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-');
    const finalFilename = `${sanitizedFilenameBase}.${fileExtension}`;

    // Create a unique key for the file in the bucket (organized by session)
    // Format: ic-chips/[sessionId]/[timestamp]-[filename]
    const key = `ic-chips/${sessionId}/${Date.now()}-${finalFilename}`;

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
 * @param {string} sessionId - Session ID to organize files by session
 * @returns {Promise<{publicUrl: string, key: string}>}
 */
async function uploadFileToR2(fileBuffer, filename, contentType, sessionId) {
  try {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME is not set in environment variables');
    }

    if (!sessionId) {
      throw new Error('sessionId is required for file upload');
    }

    // Sanitize the filename to create a safe key
    const fileExtension = filename.split('.').pop();
    const fileNameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const sanitizedFilenameBase = fileNameWithoutExtension
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-');
    const finalFilename = `${sanitizedFilenameBase}.${fileExtension}`;

    // Create a unique key for the file in the bucket (organized by session)
    // Format: ic-chips/[sessionId]/[timestamp]-[filename]
    const key = `${sessionId}/${Date.now()}-${finalFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    console.log(`=⬆️  Uploading to R2: bucket=${bucketName}, key=${key}, size=${fileBuffer.length} bytes`);

    const result = await s3Client.send(command);

    console.log(`=✅ R2 upload successful:`, result);

    // The public URL of the file after upload
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return { publicUrl, key };
  } catch (error) {
    console.error('=❌ Error uploading file to R2:', error);
    console.error('=❌ Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      bucket: process.env.R2_BUCKET_NAME,
      endpoint: process.env.R2_ENDPOINT
    });
    throw error;
  }
}

export {
  generateUploadUrl,
  uploadFileToR2,
  s3Client,
};
