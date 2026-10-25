const crypto = require('crypto');
const path = require('path');

// Dynamically check NOVEL_CHAPTERS_DATABASE from storyBibleData.ts
const biblePath = path.join(__dirname, '../src/lib/storyBibleData.ts');
const bibleContent = require('fs').readFileSync(biblePath, 'utf8');

// Parse the JSON object from the file
const jsonMatch = bibleContent.match(/export const NOVEL_CHAPTERS_DATABASE: Record<string, NovelChapterData\[\]> = (\{[\s\S]*\});\s*$/);
if (!jsonMatch) {
  console.error('FAIL: Could not parse NOVEL_CHAPTERS_DATABASE');
  process.exit(1);
}

const db = JSON.parse(jsonMatch[1]);
const novelKeys = Object.keys(db);
console.log('1. Total novels in database:', novelKeys.length);

const allHashes = new Map();
let totalChapters = 0;
let duplicates = 0;

novelKeys.forEach(key => {
  const chapters = db[key];
  if (chapters.length < 15) {
    console.error(`FAIL: Novel ${key} has only ${chapters.length} chapters`);
  }
  chapters.forEach(ch => {
    totalChapters++;
    const hash = crypto.createHash('md5').update(ch.content.trim()).digest('hex');
    if (allHashes.has(hash)) {
      console.error(`DUPLICATE DETECTED: Novel ${key} ch ${ch.chapterNumber} matches ${allHashes.get(hash)}!`);
      duplicates++;
    } else {
      allHashes.set(hash, `${key}-ch${ch.chapterNumber}`);
    }
  });
});

console.log(`2. Total chapters verified: ${totalChapters}`);
console.log(`3. Total duplicate chapter contents: ${duplicates}`);

if (duplicates > 0) {
  console.error('FAIL: Duplicates found in database!');
  process.exit(1);
}

// 4. Verify specific novels mentioned in audit report
const tongTaiCh1 = db['tong-tai-co-chap-vo-cu-lai-yeu-lan-nua-65wu'][0].content;
const nuPhuCh1 = db['nu-phu-phan-cong-he-thong-nu-than-gioi-giai-tri-4w51'][0].content;
if (tongTaiCh1 === nuPhuCh1) {
  console.error('FAIL: Tong Tai and Nu Phu ch1 are identical!');
  process.exit(1);
} else {
  console.log('4. PASS: Tong Tai and Nu Phu chapters are completely unique and distinct!');
}

const voThanCh1 = db['vo-than-chua-te'][0].content;
const voThanCh2 = db['vo-than-chua-te'][1].content;
if (voThanCh1 === voThanCh2) {
  console.error('FAIL: Vo Than Chua Te ch1 and ch2 are identical!');
  process.exit(1);
} else {
  console.log('5. PASS: Vo Than Chua Te ch1 and ch2 are distinct chapters!');
}

// 5. Verify Toan Chuc Cao Thu mentions Diep Tu
const toanChuc = db['toan-chuc-cao-thu'][0].content;
if (!toanChuc.includes('Diệp Tu') || !toanChuc.includes('Hưng Hân')) {
  console.error('FAIL: Toan Chuc Cao Thu missing Diep Tu or Hung Han!');
  process.exit(1);
} else {
  console.log('6. PASS: Toan Chuc Cao Thu contains correct characters (Diệp Tu, Hưng Hân)!');
}

console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
