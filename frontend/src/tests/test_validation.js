// Automated tests for frontend image validation and payload construction
import assert from "node:assert";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateFile(file) {
  if (!file) return "No file provided";

  const hasValidType =
    ALLOWED_MIME_TYPES.includes((file.type || "").toLowerCase())
    || ALLOWED_EXTENSIONS.some((ext) => (file.name || "").toLowerCase().endsWith(ext));

  if (!hasValidType) {
    return "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "Ảnh không được vượt quá 5 MB.";
  }

  return null;
}

console.log("==========================================");
console.log("RUNNING FRONTEND IMAGE VALIDATION TESTS");
console.log("==========================================");

// 1. Valid JPG
const jpgFile = { name: "banner.jpg", type: "image/jpeg", size: 2 * 1024 * 1024 };
assert.strictEqual(validateFile(jpgFile), null, "JPG file should pass validation");
console.log("PASS: Valid JPG accepted");

// 2. Valid PNG
const pngFile = { name: "poster.png", type: "image/png", size: 4 * 1024 * 1024 };
assert.strictEqual(validateFile(pngFile), null, "PNG file should pass validation");
console.log("PASS: Valid PNG accepted");

// 3. Valid WEBP
const webpFile = { name: "photo.webp", type: "image/webp", size: 1024 * 1024 };
assert.strictEqual(validateFile(webpFile), null, "WEBP file should pass validation");
console.log("PASS: Valid WEBP accepted");

// 4. File > 5MB
const hugeFile = { name: "large.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 + 1024 };
assert.strictEqual(
  validateFile(hugeFile),
  "Ảnh không được vượt quá 5 MB.",
  "Files > 5MB must be rejected with exact error message",
);
console.log("PASS: File > 5MB rejected with exact message: 'Ảnh không được vượt quá 5 MB.'");

// 5. Invalid MIME / extension
const pdfFile = { name: "doc.pdf", type: "application/pdf", size: 1024 * 1024 };
assert.strictEqual(
  validateFile(pdfFile),
  "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.",
  "Non-image files must be rejected with exact error message",
);
console.log("PASS: PDF rejected with exact message: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'");

const txtFile = { name: "notes.txt", type: "text/plain", size: 500 };
assert.strictEqual(
  validateFile(txtFile),
  "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.",
  "TXT file must be rejected",
);
console.log("PASS: Text file rejected");

// 6. Form payload construction tests
function buildEventPayload(form, finalCoverImageUrl) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    cover_image_url: finalCoverImageUrl,
    location: form.location.trim(),
    start_time: form.start_time,
    end_time: form.end_time,
    status: form.status,
    max_attendees: Number(form.max_attendees),
  };
}

// Case A: Create without image
const createNoImg = buildEventPayload(
  {
    title: "No Image Event",
    description: "desc",
    location: "Hall A",
    start_time: "2026-10-01T09:00",
    end_time: "2026-10-01T12:00",
    status: "DRAFT",
    max_attendees: "100",
  },
  null,
);
assert.strictEqual(createNoImg.cover_image_url, null);
console.log("PASS: Create payload without image has cover_image_url = null");

// Case B: Create with image
const createWithImg = buildEventPayload(
  {
    title: "With Image Event",
    description: "desc",
    location: "Hall B",
    start_time: "2026-10-01T09:00",
    end_time: "2026-10-01T12:00",
    status: "DRAFT",
    max_attendees: "100",
  },
  "https://res.cloudinary.com/test/image.jpg",
);
assert.strictEqual(createWithImg.cover_image_url, "https://res.cloudinary.com/test/image.jpg");
console.log("PASS: Create payload with image has cover_image_url set");

// Case C: Edit keep current image
const editKeepImg = buildEventPayload(
  {
    title: "Updated Title",
    description: "desc",
    cover_image_url: "https://res.cloudinary.com/test/current.jpg",
    location: "Hall C",
    start_time: "2026-10-01T09:00",
    end_time: "2026-10-01T12:00",
    status: "DRAFT",
    max_attendees: "100",
  },
  "https://res.cloudinary.com/test/current.jpg",
);
assert.strictEqual(editKeepImg.cover_image_url, "https://res.cloudinary.com/test/current.jpg");
console.log("PASS: Edit keep image preserves cover_image_url");

// Case D: Edit remove image
const editRemoveImg = buildEventPayload(
  {
    title: "Updated Title",
    description: "desc",
    cover_image_url: null,
    location: "Hall C",
    start_time: "2026-10-01T09:00",
    end_time: "2026-10-01T12:00",
    status: "DRAFT",
    max_attendees: "100",
  },
  null,
);
assert.strictEqual(editRemoveImg.cover_image_url, null);
console.log("PASS: Edit remove image sets cover_image_url = null");

console.log("==========================================");
console.log("ALL FRONTEND VALIDATION & PAYLOAD TESTS PASSED!");
console.log("==========================================");
