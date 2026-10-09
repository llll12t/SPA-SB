-- ==============================================================================
-- SPA Management System - Supabase Schema
-- ==============================================================================

-- 1. Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- TABLE: admins
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admins (
    id TEXT PRIMARY KEY,
    uid TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    email TEXT,
    "lineUserId" TEXT,
    role TEXT DEFAULT 'admin',
    "photoURL" TEXT,
    status TEXT DEFAULT 'available',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: employees
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    uid TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    email TEXT,
    "lineUserId" TEXT,
    role TEXT DEFAULT 'employee',
    "photoURL" TEXT,
    status TEXT DEFAULT 'available',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: customers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY, -- LINE User ID or generated ID
    "fullName" TEXT,
    phone TEXT,
    "phoneNumber" TEXT,
    email TEXT,
    points INTEGER DEFAULT 0,
    "userId" TEXT,
    "imageUrl" TEXT,
    "mergedFromPhone" BOOLEAN DEFAULT FALSE,
    "mergedPoints" INTEGER DEFAULT 0,
    "mergedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: customers_by_phone
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers_by_phone (
    id TEXT PRIMARY KEY, -- Phone number
    points INTEGER DEFAULT 0,
    "fullName" TEXT,
    "mergedToLineId" TEXT,
    "mergedAt" TIMESTAMPTZ,
    "pointsAfterMerge" INTEGER DEFAULT 0,
    "originalPoints" INTEGER DEFAULT 0,
    status TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: services
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "serviceName" TEXT,
    name TEXT,
    price NUMERIC DEFAULT 0,
    duration INTEGER DEFAULT 0,
    description TEXT,
    details TEXT,
    "imageUrl" TEXT,
    status TEXT DEFAULT 'available',
    category TEXT,
    "serviceType" TEXT DEFAULT 'single',
    "serviceOptions" JSONB DEFAULT '[]'::JSONB,
    "areaOptions" JSONB DEFAULT '[]'::JSONB,
    areas JSONB DEFAULT '[]'::JSONB,
    "selectableAreas" JSONB DEFAULT '[]'::JSONB,
    "addOnServices" JSONB DEFAULT '[]'::JSONB,
    "completionNote" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: technicians
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.technicians (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    nickname TEXT,
    "phoneNumber" TEXT,
    "lineUserId" TEXT,
    "imageUrl" TEXT,
    status TEXT DEFAULT 'available',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: appointments
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    status TEXT DEFAULT 'pending',
    date TEXT,
    time TEXT,
    "technicianId" TEXT,
    "userId" TEXT,
    "serviceId" TEXT,
    queue TEXT,
    "queueNumber" TEXT,
    "customerInfo" JSONB DEFAULT '{}'::JSONB,
    "serviceInfo" JSONB DEFAULT '{}'::JSONB,
    "appointmentInfo" JSONB DEFAULT '{}'::JSONB,
    "paymentInfo" JSONB DEFAULT '{}'::JSONB,
    "reviewInfo" JSONB DEFAULT '{}'::JSONB,
    "technicianInfo" JSONB DEFAULT '{}'::JSONB,
    timeline JSONB DEFAULT '{}'::JSONB,
    "completionNote" TEXT,
    "googleCalendarEventId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: rewards
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rewards (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    description TEXT,
    "pointsRequired" INTEGER DEFAULT 0,
    "discountType" TEXT DEFAULT 'percentage',
    "discountValue" NUMERIC DEFAULT 0,
    value NUMERIC DEFAULT 0,
    "redeemedCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: coupons
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coupons (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "customerId" TEXT NOT NULL, -- references customer id / line userId
    "rewardId" TEXT,
    name TEXT,
    description TEXT,
    "discountType" TEXT DEFAULT 'percentage',
    "discountValue" NUMERIC DEFAULT 0,
    used BOOLEAN DEFAULT FALSE,
    "usedAt" TIMESTAMPTZ,
    "appointmentId" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "redeemedAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: reviews
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY, -- usually appointmentId
    "appointmentId" TEXT,
    "userId" TEXT,
    "technicianId" TEXT,
    "customerName" TEXT,
    rating INTEGER DEFAULT 5,
    comment TEXT,
    "pointsAwarded" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: notifications
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    title TEXT,
    message TEXT,
    type TEXT,
    "isRead" BOOLEAN DEFAULT FALSE,
    data JSONB DEFAULT '{}'::JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: settings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY, -- 'profile', 'notifications', 'booking', 'points', 'payment', 'calendar'
    data JSONB DEFAULT '{}'::JSONB,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- TABLE: pointMergeHistory
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public."pointMergeHistory" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "userId" TEXT,
    phone TEXT,
    "phoneNumber" TEXT,
    "mergedPoints" INTEGER DEFAULT 0,
    "originalLinePoints" INTEGER DEFAULT 0,
    "newTotalPoints" INTEGER DEFAULT 0,
    "mergeType" TEXT DEFAULT 'phone_to_line',
    "mergedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY SPEED
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON public.appointments(date, time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_userId ON public.appointments("userId");
CREATE INDEX IF NOT EXISTS idx_appointments_technicianId ON public.appointments("technicianId");
CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone ON public.appointments(((("customerInfo"->>'phone')::TEXT)));
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON public.appointments("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_userId ON public.customers("userId");
CREATE INDEX IF NOT EXISTS idx_customers_createdAt ON public.customers("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_coupons_customerId_used ON public.coupons("customerId", used);
CREATE INDEX IF NOT EXISTS idx_coupons_redeemedAt ON public.coupons("redeemedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS idx_services_serviceName ON public.services("serviceName");

CREATE INDEX IF NOT EXISTS idx_technicians_status ON public.technicians(status);
CREATE INDEX IF NOT EXISTS idx_technicians_phoneNumber ON public.technicians("phoneNumber");
CREATE INDEX IF NOT EXISTS idx_technicians_lineUserId ON public.technicians("lineUserId");

CREATE INDEX IF NOT EXISTS idx_employees_lineUserId ON public.employees("lineUserId");
CREATE INDEX IF NOT EXISTS idx_employees_phoneNumber ON public.employees("phoneNumber");

CREATE INDEX IF NOT EXISTS idx_admins_lineUserId ON public.admins("lineUserId");

CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_createdAt ON public.reviews("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON public.notifications("isRead");
CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON public.notifications("createdAt" DESC);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
-- Enable Realtime for live UI updates (ปลอดภัย รันซ้ำได้ไม่เกิด Error 42710)
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'appointments',
        'notifications',
        'customers',
        'coupons',
        'rewards',
        'services',
        'technicians',
        'settings'
    ];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl IN ARRAY tables LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
            ) THEN
                BEGIN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
                EXCEPTION WHEN OTHERS THEN
                    NULL;
                END;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Enable RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers_by_phone ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pointMergeHistory" ENABLE ROW LEVEL SECURITY;

-- Allow public / anon and authenticated access for SPA app operations (ปลอดภัย รันซ้ำได้ไม่เกิด Error policy already exists)
DO $$
DECLARE
    item record;
BEGIN
    FOR item IN (
        SELECT 'Public Read/Write for admins' AS pol, 'admins' AS tbl UNION ALL
        SELECT 'Public Read/Write for employees', 'employees' UNION ALL
        SELECT 'Public Read/Write for customers', 'customers' UNION ALL
        SELECT 'Public Read/Write for customers_by_phone', 'customers_by_phone' UNION ALL
        SELECT 'Public Read/Write for services', 'services' UNION ALL
        SELECT 'Public Read/Write for technicians', 'technicians' UNION ALL
        SELECT 'Public Read/Write for appointments', 'appointments' UNION ALL
        SELECT 'Public Read/Write for rewards', 'rewards' UNION ALL
        SELECT 'Public Read/Write for coupons', 'coupons' UNION ALL
        SELECT 'Public Read/Write for reviews', 'reviews' UNION ALL
        SELECT 'Public Read/Write for notifications', 'notifications' UNION ALL
        SELECT 'Public Read/Write for settings', 'settings' UNION ALL
        SELECT 'Public Read/Write for pointMergeHistory', 'pointMergeHistory'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', item.pol, item.tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true);', item.pol, item.tbl);
    END LOOP;
END $$;

-- ==============================================================================
-- DEFAULT SEED DATA (Settings)
-- ==============================================================================
INSERT INTO public.settings (id, data, "updatedAt")
VALUES
    ('profile', '{
        "storeName": "SPA & MASSAGE",
        "currency": "฿",
        "currencySymbol": "บาท",
        "contactPhone": "",
        "address": "",
        "description": ""
    }'::JSONB, NOW()),

    ('booking', '{
        "useTechnician": false,
        "totalTechnicians": 1,
        "bufferMinutes": 0,
        "timeQueues": [],
        "weeklySchedule": {},
        "holidayDates": []
    }'::JSONB, NOW()),

    ('points', '{
        "enablePointSystem": true,
        "enableReviewPoints": true,
        "reviewPoints": 5,
        "enablePurchasePoints": false,
        "pointsPerCurrency": 100,
        "enableVisitPoints": false,
        "pointsPerVisit": 1
    }'::JSONB, NOW()),

    ('payment', '{
        "method": "promptpay",
        "promptPayAccount": "",
        "qrCodeImageUrl": "",
        "bankInfoText": ""
    }'::JSONB, NOW()),

    ('calendar', '{
        "enabled": false,
        "calendarId": ""
    }'::JSONB, NOW()),

    ('notifications', '{
        "allNotifications": { "enabled": true },
        "adminNotifications": {
            "enabled": true,
            "newBooking": true,
            "bookingCancelled": true,
            "paymentReceived": true,
            "customerConfirmed": true
        },
        "customerNotifications": {
            "enabled": true,
            "newBooking": true,
            "appointmentConfirmed": true,
            "serviceCompleted": true,
            "appointmentCancelled": true,
            "appointmentReminder": true,
            "reviewRequest": true,
            "paymentInvoice": true,
            "dailyAppointmentNotification": true
        }
    }'::JSONB, NOW()),

    ('system', '{
        "appUrl": "",
        "cronSecret": "your-secure-cron-secret"
    }'::JSONB, NOW())
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- DEFAULT SEED DATA (Admin Instructions)
-- ==============================================================================
-- หมายเหตุ: ทาง Supabase ไม่อนุญาตให้ทำ INSERT ลง auth.users โดยตรงผ่าน SQL
-- เพราะระบบ GoTrue Auth ต้องการ auth.identities และฟิลด์ภายในเฉพาะ
-- ในการสร้าง Admin แนะนำให้รันคำสั่ง: node scripts/create-admin.mjs

-- ==============================================================================
-- SUPABASE CRON JOBS (pg_cron + pg_net แบบ Auto-Configured)
-- ==============================================================================
-- รันไฟล์นี้จบในครั้งเดียวได้ทันที! ระบบจะดึง URL และ CRON_SECRET จากตาราง settings อัตโนมัติ
-- เมื่อเว็บเปิดใช้งาน ระบบจะซิงค์ URL เว็บจริงลงใน settings ให้เองโดยไม่ต้องแก้ SQL นี้เลย

-- 1. เปิด Extensions ที่จำเป็น
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. ฟังก์ชันเรียก API แจ้งเตือนล่วงหน้า 1 ชั่วโมง (ดึงค่าจาก settings อัตโนมัติ)
CREATE OR REPLACE FUNCTION public.trigger_scheduled_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_app_url TEXT;
    v_cron_secret TEXT;
BEGIN
    SELECT data->>'appUrl', data->>'cronSecret'
    INTO v_app_url, v_cron_secret
    FROM public.settings
    WHERE id = 'system';

    -- ยิงแจ้งเตือนเมื่อมีการระบุ URL ของเว็บเรียบร้อยแล้ว
    IF v_app_url IS NOT NULL AND v_app_url <> '' AND v_app_url NOT LIKE '%localhost%' THEN
        PERFORM net.http_get(
            url := rtrim(v_app_url, '/') || '/api/cron/send-reminders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE(v_cron_secret, '')
            )
        );
    END IF;
END;
$$;

-- 3. ฟังก์ชันเรียก API แจ้งเตือนสรุปคิวประจำวัน (ดึงค่าจาก settings อัตโนมัติ)
CREATE OR REPLACE FUNCTION public.trigger_daily_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_app_url TEXT;
    v_cron_secret TEXT;
BEGIN
    SELECT data->>'appUrl', data->>'cronSecret'
    INTO v_app_url, v_cron_secret
    FROM public.settings
    WHERE id = 'system';

    -- ยิงแจ้งเตือนเมื่อมีการระบุ URL ของเว็บเรียบร้อยแล้ว
    IF v_app_url IS NOT NULL AND v_app_url <> '' AND v_app_url NOT LIKE '%localhost%' THEN
        PERFORM net.http_get(
            url := rtrim(v_app_url, '/') || '/api/cron/send-daily-notifications',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE(v_cron_secret, '')
            )
        );
    END IF;
END;
$$;

-- 4. ตั้งเวลา Cron Jobs (ปลอดภัย รันซ้ำได้ไม่เกิด Error)
DO $$
BEGIN
    BEGIN
        PERFORM cron.unschedule('send-appointment-reminders');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        PERFORM cron.unschedule('send-daily-appointment-notifications');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- ตั้งเตือนล่วงหน้า 1 ชั่วโมง (รันทุกต้นชั่วโมง นาทีที่ 00)
    PERFORM cron.schedule(
        'send-appointment-reminders',
        '0 * * * *',
        'SELECT public.trigger_scheduled_reminders();'
    );

    -- ตั้งเตือนสรุปคิวประจำวัน (รันทุกเช้า 08:00 น. ตามเวลาไทย = 01:00 UTC)
    PERFORM cron.schedule(
        'send-daily-appointment-notifications',
        '0 1 * * *',
        'SELECT public.trigger_daily_notifications();'
    );
END $$;




