import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ฟังก์ชันโหลด Environment Variables จาก .env.local หรือ .env
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

// ข้อมูลบริการทั้ง 5 รายการ
const DEFAULT_SERVICES = [
    {
        serviceName: 'นวดแผนไทยโบราณราชสำนัก',
        name: 'นวดแผนไทยโบราณราชสำนัก',
        category: 'นวดแผนไทย',
        price: 450,
        duration: 60,
        serviceType: 'single',
        status: 'available',
        details: 'นวดกดจุดสัญญาณและยืดเหยียดกล้ามเนื้อตามศาสตร์แผนไทยโบราณ บรรเทาอาการตึงเมื่อยล้า คลายเส้น และกระตุ้นการไหลเวียนของโลหิตทั่วร่างกาย',
        description: 'นวดกดจุดสัญญาณและยืดเหยียดกล้ามเนื้อตามศาสตร์แผนไทยโบราณ',
        imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop&q=80',
        addOnServices: [
            { name: 'ลูกประคบสมุนไพรสดอุ่น', price: 150, duration: 15 },
            { name: 'นวดศีรษะและคอบ่าไหล่เน้นจุด', price: 100, duration: 15 }
        ],
        completionNote: 'ดื่มน้ำอุ่นหลังนวดและหลีกเลี่ยงการอาบน้ำเย็นทันที 1 ชั่วโมง'
    },
    {
        serviceName: 'นวดอโรมาเธอราพีน้ำมันหอมระเหย',
        name: 'นวดอโรมาเธอราพีน้ำมันหอมระเหย',
        category: 'นวดอโรมา',
        price: 790,
        duration: 90,
        serviceType: 'single',
        status: 'available',
        details: 'การนวดสัมผัสนุ่มนวลผสานน้ำมันหอมระเหยบริสุทธิ์สกัดจากธรรมชาติ กลิ่นหอมบำบัดช่วยคลายความเครียดสะสม ผ่อนคลายกล้ามเนื้อ พร้อมบำรุงผิวให้เนียนนุ่มชุ่มชื้น',
        description: 'นวดผ่อนคลายด้วยน้ำมันหอมระเหยธรรมชาติ บำรุงผิวและคลายความตึงเครียด',
        imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&auto=format&fit=crop&q=80',
        addOnServices: [
            { name: 'อบไอน้ำสมุนไพรสดขับสารพิษ', price: 150, duration: 20 },
            { name: 'มาส์กบำรุงผิวขาวกระจ่างใส', price: 180, duration: 20 }
        ],
        completionNote: 'ปล่อยให้น้ำมันซึมซาบสู่ผิวกายประมาณ 2-3 ชั่วโมงเพื่อประสิทธิภาพสูงสุด'
    },
    {
        serviceName: 'นวดบำบัดออฟฟิศซินโดรม',
        name: 'นวดบำบัดออฟฟิศซินโดรม',
        category: 'นวดเฉพาะจุด',
        price: 590,
        duration: 60,
        serviceType: 'single',
        status: 'available',
        details: 'ออกแบบพิเศษสำหรับคนทำงานออฟฟิศ เน้นการคลายปมกล้ามเนื้อพังผืด (Trigger Points) บริเวณคอ บ่า สะบัก และหลังส่วนล่าง บรรเทาอาการปวดศีรษะและสะบักจมอย่างตรงจุด',
        description: 'เน้นคลายกล้ามเนื้อคอ บ่า ไหล่ และสะบักหลัง สำหรับคนทำงานออฟฟิศ',
        imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop&q=80',
        addOnServices: [
            { name: 'ยาหม่องสมุนไพรสูตรเย็นเข้มข้น', price: 60, duration: 0 },
            { name: 'ประคบร้อนลดการอักเสบกล้ามเนื้อ', price: 150, duration: 15 }
        ],
        completionNote: 'แนะนำปรับท่านั่งทำงานและหมั่นยืดเหยียดระหว่างวัน'
    },
    {
        serviceName: 'สครับขัดผิวกายออร์แกนิกโกลว์',
        name: 'สครับขัดผิวกายออร์แกนิกโกลว์',
        category: 'ทรีตเมนต์บำรุงผิว',
        price: 650,
        duration: 60,
        serviceType: 'single',
        status: 'available',
        details: 'ทรีตเมนต์ผลัดเซลล์ผิวที่ตายแล้วอย่างอ่อนโยนด้วยเกลือขัดผิวออร์แกนิกผสมน้ำผึ้งและวิตามินอี ช่วยฟื้นฟูผิวหมองคล้ำ ให้กลับมาเรียบเนียน เปล่งปลั่งกระจ่างใสมีออร่า',
        description: 'สครับผิวออร์แกนิกผลัดเซลล์ผิว เผยผิวกายเนียนนุ่ม ชุ่มชื้นสุขภาพดี',
        imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80',
        addOnServices: [
            { name: 'พอกโคลนธรรมชาติบำรุงล้ำลึก', price: 200, duration: 20 },
            { name: 'แช่อ่างน้ำนมเพื่อผิวนุ่ม', price: 180, duration: 20 }
        ],
        completionNote: 'ทาโลชั่นบำรุงผิวและครีมกันแดดอย่างสม่ำเสมอหลังการขัดผิว'
    },
    {
        serviceName: 'สปาและนวดกดจุดสะท้อนฝ่าเท้า',
        name: 'สปาและนวดกดจุดสะท้อนฝ่าเท้า',
        category: 'สปาเท้า',
        price: 390,
        duration: 60,
        serviceType: 'single',
        status: 'available',
        details: 'เริ่มต้นด้วยการแช่เท้าในน้ำเกลือแร่สมุนไพรอุ่น สครับทำความสะอาดส้นเท้า ตามด้วยการนวดกดจุดสะท้อนฝ่าเท้าเพื่อกระตุ้นการทำงานของอวัยวะภายใน คลายความเมื่อยล้าและช่วยให้หลับสบาย',
        description: 'แช่เท้าสมุนไพร ขัดส้นเท้า พร้อมนวดกดจุดสะท้อนฝ่าเท้ากระตุ้นสุขภาพ',
        imageUrl: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=800&auto=format&fit=crop&q=80',
        addOnServices: [
            { name: 'มาร์กพาราฟินบำรุงส้นเท้าแตก', price: 190, duration: 20 },
            { name: 'สครับเกลือหิมาลายันขัดเท้า', price: 90, duration: 10 }
        ],
        completionNote: 'สวมถุงเท้าเพื่อรักษาความชุ่มชื้นหลังการทำสปา'
    }
];

async function seedServices() {
    const env = loadEnv();
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log(`\n======================================================`);
    console.log(` 🌸 เริ่มต้นสร้างรายการบริการสปา & นวด (5 รายการ)`);
    console.log(`======================================================\n`);

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ ไม่พบ Supabase URL หรือ Key ในไฟล์ .env / .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        let createdCount = 0;

        for (const service of DEFAULT_SERVICES) {
            // ตรวจสอบว่ามีบริการนี้อยู่แล้วหรือไม่
            const { data: existing, error: checkError } = await supabase
                .from('services')
                .select('id, serviceName')
                .or(`serviceName.eq."${service.serviceName}",name.eq."${service.name}"`)
                .limit(1);

            if (checkError) {
                console.warn(`⚠️ เกิดข้อผิดพลาดในการตรวจสอบ "${service.serviceName}":`, checkError.message);
            }

            if (existing && existing.length > 0) {
                console.log(`ℹ️ บริการ "${service.serviceName}" มีอยู่ในระบบแล้ว (ID: ${existing[0].id}) -> ข้าม`);
                continue;
            }

            // บันทึกบริการใหม่
            const { data: inserted, error: insertError } = await supabase
                .from('services')
                .insert([
                    {
                        ...service,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ])
                .select();

            if (insertError) {
                console.error(`❌ ล้มเหลวในการสร้าง "${service.serviceName}":`, insertError.message);
            } else {
                createdCount++;
                const newId = inserted?.[0]?.id || 'OK';
                console.log(`✅ [${createdCount}/5] สร้างบริการสำเร็จ: "${service.serviceName}" (ราคา: ${service.price} บาท, เวลา: ${service.duration} นาที, ID: ${newId})`);
            }
        }

        console.log(`\n======================================================`);
        console.log(`🎉 ดำเนินการเสร็จสิ้น! สร้างบริการใหม่ทั้งหมด ${createdCount} รายการ`);
        console.log(`👉 สามารถดูรายการบริการได้ที่หน้า /services ในระบบแอดมิน`);
        console.log(`======================================================\n`);
    } catch (err) {
        console.error('❌ เกิดข้อผิดพลาดร้ายแรง:', err);
        process.exit(1);
    }
}

seedServices();
