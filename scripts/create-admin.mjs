import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// อ่านค่าจาก .env.local หรือ .env
function loadEnv() {
    const envPaths = ['.env.local', '.env'];
    const env = { ...process.env };

    for (const file of envPaths) {
        const fullPath = path.resolve(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
            const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const k = trimmed.slice(0, eqIdx).trim();
                    let v = trimmed.slice(eqIdx + 1).trim();
                    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.slice(1, -1);
                    }
                    if (!env[k]) env[k] = v;
                }
            }
        }
    }
    return env;
}

async function createAdmin() {
    const env = loadEnv();
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    const email = process.argv[2] || 'admin@admin.com';
    const password = process.argv[3] || '012345678';

    console.log(`\n===========================================`);
    console.log(` กำลังสร้างผู้ดูแลระบบ (Admin)`);
    console.log(` Email:    ${email}`);
    console.log(` Password: ${password}`);
    console.log(`===========================================\n`);

    if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('your-supabase-service-role-key')) {
        console.error('❌ ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local');
        console.error('👉 กรุณาตั้งค่า .env.local ด้วย Credential จริงของ Supabase ก่อนรันสคริปต์นี้');
        process.exit(1);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 1. ตรวจสอบว่ามีผู้ใช้นี้อยู่แล้วใน Auth หรือยัง
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        let existingUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        let userId = existingUser?.id;

        if (existingUser) {
            console.log(`ℹ️ พบผู้ใช้ ${email} ในระบบแล้ว กำลังอัปเดตรหัสผ่าน...`);
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: password,
                email_confirm: true,
                user_metadata: { firstName: 'Admin', lastName: 'System' }
            });
            if (updateError) throw updateError;
            console.log('✅ อัปเดตรหัสผ่านเรียบร้อยแล้ว');
        } else {
            console.log(`➕ กำลังสร้างผู้ใช้ใหม่ใน Supabase Auth...`);
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: { firstName: 'Admin', lastName: 'System' }
            });
            if (createError) throw createError;
            userId = newUser.user.id;
            console.log(`✅ สร้างผู้ใช้ใน Supabase Auth สำเร็จ (UID: ${userId})`);
        }

        // 2. บันทึกข้อมูลลงตาราง public.admins
        console.log(`📝 กำลังบันทึกสิทธิ์ลงตาราง public.admins...`);
        const { error: dbError } = await supabaseAdmin
            .from('admins')
            .upsert({
                id: userId,
                uid: userId,
                email: email,
                firstName: 'Admin',
                lastName: 'System',
                role: 'admin',
                status: 'available',
                updatedAt: new Date().toISOString()
            }, { onConflict: 'id' });

        if (dbError) throw dbError;

        console.log(`\n🎉 สร้างบัญชี Admin สำเร็จเรียบร้อย!`);
        console.log(`👉 สามารถเข้าใช้งานได้ที่ http://localhost:3000/login`);
        console.log(`   Email:    ${email}`);
        console.log(`   Password: ${password}\n`);

    } catch (err) {
        console.error('❌ เกิดข้อผิดพลาด:', err.message || err);
        process.exit(1);
    }
}

createAdmin();
