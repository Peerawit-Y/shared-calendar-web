-- ==============================================================================
-- SHARED CALENDAR & EXAM VAULT - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- วิธีใช้งาน:
-- 1. ไปที่ Supabase Dashboard (https://supabase.com/dashboard)
-- 2. เลือกโปรเจกต์ของคุณ -> ไปที่เมนู "SQL Editor" ด้านซ้าย
-- 3. วางโค้ดทั้งหมดนี้ลงไป แล้วกดปุ่ม "Run" (สีเขียว)
-- ==============================================================================

-- 1. สร้างตาราง tasks (ตารางงานและการสอบบนปฏิทิน)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    term TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'การบ้าน',
    due_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'รอดำเนินการ',
    link TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. สร้างตาราง exam_guides (คลังแนวข้อสอบ & สมุดจด A4 Word Document)
CREATE TABLE IF NOT EXISTS public.exam_guides (
    id TEXT PRIMARY KEY,
    term TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    exam_type TEXT NOT NULL DEFAULT 'สรุปบทเรียน',
    title TEXT NOT NULL DEFAULT '',
    format TEXT DEFAULT '',
    scope TEXT DEFAULT '',              -- ไม่จำกัด 50,000 ตัวอักษร จุได้เต็มที่
    tips TEXT DEFAULT '',
    pdf_link TEXT DEFAULT '',
    contributor TEXT DEFAULT 'เพื่อนร่วมชั้น',
    content_html TEXT DEFAULT '',
    pages JSONB DEFAULT '[]'::jsonb,
    created_at TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. เปิดระบบ Row Level Security (RLS) เพื่อความปลอดภัย
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_guides ENABLE ROW LEVEL SECURITY;

-- ลบนโยบายเดิมถ้ามีอยู่แล้ว
DROP POLICY IF EXISTS "Allow public read on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public insert on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public update on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public delete on tasks" ON public.tasks;

DROP POLICY IF EXISTS "Allow public read on exam_guides" ON public.exam_guides;
DROP POLICY IF EXISTS "Allow public insert on exam_guides" ON public.exam_guides;
DROP POLICY IF EXISTS "Allow public update on exam_guides" ON public.exam_guides;
DROP POLICY IF EXISTS "Allow public delete on exam_guides" ON public.exam_guides;

-- นโยบาย tasks: อ่าน เขียน แก้ไข ลบ ได้อิสระผ่านเว็บ (Anon Public Access)
CREATE POLICY "Allow public read on tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on tasks" ON public.tasks FOR DELETE USING (true);

-- นโยบาย exam_guides: อ่าน เขียน แก้ไข ลบ ได้อิสระผ่านเว็บ (Anon Public Access)
CREATE POLICY "Allow public read on exam_guides" ON public.exam_guides FOR SELECT USING (true);
CREATE POLICY "Allow public insert on exam_guides" ON public.exam_guides FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on exam_guides" ON public.exam_guides FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on exam_guides" ON public.exam_guides FOR DELETE USING (true);

-- 4. เปิด Realtime สำหรับทั้งสองตาราง (เพื่อนแก้งาน หน้าจอจะอัปเดตสดทันทีไม่ต้องกดรีเฟรช)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.tasks, public.exam_guides;
COMMIT;
