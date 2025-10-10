import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testR2Upload = async () => {
  try {
    console.log('=🧪 Testing R2 upload functionality...\n');

    // Create form data
    const form = new FormData();
    form.append('userQuery', 'scan');

    // Check if test images exist
    const testImagesDir = path.join(__dirname, '../images');

    if (!fs.existsSync(testImagesDir)) {
      console.log('=⚠️  No images directory found. Creating test with placeholder...');
      console.log('=📝 Please add test images to:', testImagesDir);
      return;
    }

    // Get all image files from the images directory
    const files = fs.readdirSync(testImagesDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    if (files.length === 0) {
      console.log('=⚠️  No image files found in images directory');
      console.log('=📝 Please add test images to:', testImagesDir);
      return;
    }

    console.log(`=📦 Found ${files.length} image(s) to upload:`);
    files.forEach(file => console.log(`   - ${file}`));
    console.log('');

    // Append images to form
    files.forEach(file => {
      const filePath = path.join(testImagesDir, file);
      form.append('images', fs.createReadStream(filePath), {
        filename: file,
        contentType: file.endsWith('.png') ? 'image/png' : 'image/jpeg'
      });
    });

    // Send POST request using form-data's submit method (works better than fetch)
    console.log('=🚀 Sending POST request to http://localhost:8000/chat...\n');

    const data = await new Promise((resolve, reject) => {
      form.submit('http://localhost:8000/chat', (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        let responseBody = '';
        res.on('data', chunk => {
          responseBody += chunk.toString();
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(responseBody);
            if (res.statusCode !== 201 && res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(jsonData)}`));
            } else {
              resolve(jsonData);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${responseBody.substring(0, 200)}`));
          }
        });

        res.on('error', reject);
      });
    });

    console.log('=✅ Success! Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n=📋 Session ID:', data.sessionId);
    console.log('=📋 Message ID:', data.messageId);
    console.log('\n=🔗 Check your R2 bucket at:');
    console.log(`   https://pub-4d357875d4af49b0a0ff15128eb2014b.r2.dev/ic-chips/${data.sessionId}/`);
    console.log('\n=📊 Monitor Firestore for real-time updates on message:', data.messageId);

  } catch (error) {
    console.error('=❌ Test failed:', error.message);
    console.error(error.stack);
  }
};

// Run the test
console.log('===========================================');
console.log('    R2 Upload Test Script');
console.log('===========================================\n');
testR2Upload();
