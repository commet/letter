// Upload photos_final → Supabase Storage with sanitized names
// Run: node scripts/upload-photos.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = join(__dirname, "..", "..", "letter-video", "public", "photos_final");

const supabase = createClient(
  "https://hgltvdshuyfffskvjmst.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnbHR2ZHNodXlmZmZza3ZqbXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODk1MzEsImV4cCI6MjA2ODA2NTUzMX0.PyoZ0e0P5NtWjMimxGimsJQ6nfFNRFmT4i0bRMEjxTk"
);

const BUCKET = "letter-photos";

// Ordered file list matching data.ts order
const FILES = [
  "1. 슬기 성모병원.JPG",
  "1. 예찬 성모병원.jpg",
  "2. 슬기 생일.JPG",
  "2. 예찬 생일.png",
  "4. 슬기 아빠와.JPG",
  "4. 예찬 아빠와.jpg",
  "5. 슬기 장난기.JPG",
  "5. 예찬 장난기.jpg",
  "6. 슬기 부엌.JPG",
  "6. 예찬 부엌.jpg",
  "7. 슬기 그림.JPG",
  "7. 예찬 그림.jpg",
  "3. 경복궁.jpg",
  "8. 분당선교원.jpeg",
  "9. 분당선교원 2.jpeg",
  "10. 붉은악마.jpeg",
  "11. 슬기 붉은악마.jpeg",
  "11. 예찬 붉은악마.jpeg",
  "12. 여름 단체사진.jpeg",
  "13. 가을 단체사진.jpeg",
  "14. 겨울 단체사진.jpeg",
  "15. 서울 단체사진.jpeg",
  "16. 영화관.jpeg",
  "17. 교회 기획실.jpeg",
  "18. 스키장.jpeg",
  "19. 고등학교 졸업식.jpeg",
  "20. 침례식.jpeg",
  "21. 여행 식사 1.jpeg",
  "22. 여행 식사 2.jpeg",
  "23.  여행 단사 1.jpeg",
  "24. 여행 단사 2.jpeg",
  "25. 여행 단사 3.jpeg",
  "26. 여행 단사 4.jpeg",
  "27. 결혼식 공연 1.jpeg",
  "28. 결혼식 공연 2.jpeg",
  "29. 결혼식 공연 3.jpeg",
  "30. 결혼식 공연 4.jpeg",
  "31. 갤러리 전시 1.jpeg",
  "32. 갤러리 전시 2.jpeg",
  "33. 갤러리 전시 3.jpeg",
  "34. 갤러리 전시 4.jpeg",
  "35. 뉴욕 1.png",
  "36. 뉴욕 2.png",
  "37. 뉴욕 3.jpg",
  "38. 뉴욕 4.png",
  "39. 예찬 군입대.jpg",
  "40. 예찬 군입대 2.png",
  "41. 예찬 군입대 3.jpeg",
  "42. 예찬 군입대 4.jpeg",
  "43. 슬기누나 졸업.jpeg",
  "44. 예찬 졸업식.jpg",
  "45. 두 사람 1.jpg",
  "46. 두 사람 2.jpg",
  "47. 두 사람 3.jpg",
  "48. 두 사람 4.png",
  "49. 두 사람 5.jpg",
  "50. 두 사람 6.jpg",
  "51. 두 사람 7.jpg",
  "52. 두 사람 8.jpg",
  "53. 마지막.jpg",
];

let ok = 0, fail = 0;
const mapping = {};

for (let i = 0; i < FILES.length; i++) {
  const file = FILES[i];
  const ext = extname(file).toLowerCase();
  const num = String(i + 1).padStart(3, "0");
  const key = `final/${num}${ext}`;

  const filePath = join(PHOTOS_DIR, file);
  let fileData;
  try {
    fileData = readFileSync(filePath);
  } catch {
    console.error(`MISSING: ${file}`);
    fail++;
    continue;
  }

  const contentType =
    ext === ".png" ? "image/png" :
    ext === ".webp" ? "image/webp" : "image/jpeg";

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, fileData, { contentType, upsert: true });

  if (error) {
    console.error(`FAIL [${num}]: ${file} — ${error.message}`);
    fail++;
  } else {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    mapping[file] = data.publicUrl;
    ok++;
    process.stdout.write(`[${num}] ${file} → ${key}\n`);
  }
}

console.log(`\nDone. uploaded=${ok} failed=${fail}`);
console.log("\n// URL mapping for data.ts:");
for (const [orig, url] of Object.entries(mapping)) {
  console.log(`// ${orig} → ${url}`);
}
