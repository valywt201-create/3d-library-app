# ملاحظات نشر Supabase — بيانات عامة فقط

- لوحة المشروع: https://supabase.com/dashboard/project/ruhoptuesxvzwfcrwwfg
- صفحة الوظائف: https://supabase.com/dashboard/project/ruhoptuesxvzwfcrwwfg/functions
- صفحة الأسرار: https://supabase.com/dashboard/project/ruhoptuesxvzwfcrwwfg/functions/secrets
- المشروع المحلي يطابق مرجع المشروع في اللوحة.
- في فحص قائمة الأسرار ظهر الاسمان `GEMINI_API_KEY` و`GOOGLE_CLIENT_ID` بعد حفظ معرّف OAuth العام. لم تُحفظ أو تُقرأ أي قيمة سرية في هذه الملاحظات.
- لم تظهر `notes-ai` أو `library-api` في قائمة الوظائف عند فحصها.
- المصدر المحلي لوظيفة المساعد: `supabase/functions/notes-ai/index.ts`. العميل يستدعي `notes-ai` عبر `src/lib/studyAssistant.ts`، وتستخدم الواجهة هذا المسار من `src/components/NotesEditor.tsx`.
- ملف `supabase/config.toml` يحدد `verify_jwt = false` لوظيفتي المشروع لأن الوظيفة تتحقق من Google ID token بنفسها.
- صفحة الإنشاء المفتوحة: https://supabase.com/dashboard/project/ruhoptuesxvzwfcrwwfg/functions/new
- لم يُنشر أي كود إلى Supabase حتى الآن؛ المسودة السابقة أُغلقت، والمحرر الحالي جديد ونظيف.
