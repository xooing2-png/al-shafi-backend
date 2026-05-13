# Al-Shafi Backend API

Backend API لتطبيق Al-Shafi الصحي، بديل MySQL لـ Firebase.

## المتطلبات

- Node.js 18+
- MySQL 8.0+
- npm أو yarn

## التثبيت والتشغيل

### 1. تثبيت الاعتمادات

```bash
npm install
```

### 2. إعداد قاعدة البيانات

```bash
# إنشاء قاعدة البيانات
mysql -u root -p -e "CREATE DATABASE al_shafi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. إعداد متغيرات البيئة

```bash
# انسخ .env.example إلى .env
cp .env.example .env

# ثم عدّل .env بـ بيانات قاعدة البيانات الخاصة بك
```

### 4. تشغيل التهجير (Migration)

```bash
npm run migrate
```

### 5. تشغيل السيرفر

```bash
# في بيئة التطوير (مع watch mode)
npm run dev

# في الإنتاج
npm run build
npm start
```

السيرفر سيعمل على `http://localhost:3000`

## الـ API Endpoints

### Authentication

- `POST /api/auth/register` - تسجيل حساب جديد
- `POST /api/auth/login` - تسجيل الدخول
- `GET /api/auth/me` - الحصول على بيانات المستخدم الحالي

### Users

- `GET /api/users/:userId` - الحصول على بيانات مستخدم
- `PUT /api/users/profile` - تحديث بيانات المستخدم
- `POST /api/users/notification-token` - حفظ FCM token

### Appointments

- `POST /api/appointments` - إنشاء موعد جديد
- `GET /api/appointments` - الحصول على المواعيد
- `PATCH /api/appointments/:appointmentId/status` - تحديث حالة الموعد
- `DELETE /api/appointments/:appointmentId` - إلغاء الموعد

## مثال على الطلبات

### تسجيل حساب جديد

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "أحمد",
    "email": "ahmed@example.com",
    "phone": "07712345678",
    "password": "secure123",
    "role": "patient"
  }'
```

### تسجيل الدخول

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "password": "secure123"
  }'
```

### إنشاء موعد

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "clinicId": "clinic-id",
    "doctorId": "doctor-id",
    "appointmentTime": "2026-05-15T10:00:00",
    "notes": "مراجعة دورية"
  }'
```

## البنية

```
src/
├── config/          # إعدادات قاعدة البيانات
├── controllers/     # Logic للـ API
├── middleware/      # Middleware مثل Authentication
├── routes/          # تعريف الـ Routes
├── scripts/         # Scripts مثل Migration
├── types/           # TypeScript types
└── utils/           # Utility functions
```

## الأدوار المدعومة

- `patient` - مريض
- `doctor` - طبيب
- `nurse` - ممرضة
- `secretary` - سكرتيرة
- `pharmacist` - صيدلي
- `lab_technician` - محلل مختبر
- `admin` - مسؤول

## ملاحظات التطوير

- استخدم Bearer token في Authorization header لجميع الـ API المحمية
- التاريخ والوقت يجب أن يكون بصيغة ISO 8601 (مثال: 2026-05-15T10:00:00)
- جميع البيانات المرجعة بصيغة JSON
- أكواد الخطأ:
  - 400: Bad Request
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not Found
  - 500: Server Error

## الخطوات التالية

الحالة الحالية تغطي:
- ✅ Authentication (Register/Login)
- ✅ User Management
- ✅ Appointments
- ⏳ Clinics
- ⏳ Prescriptions
- ⏳ Pharmacy Orders
- ⏳ Lab Orders
- ⏳ Hospitals
- ⏳ Notifications

تابع التحديثات للمزيد من الـ Endpoints.
