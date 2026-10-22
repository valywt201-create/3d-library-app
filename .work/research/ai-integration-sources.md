# مراجع تكامل مساعد الدراسة (سجل عمل)

Supabase يوثق استدعاء الوظيفة عبر `supabase.functions.invoke` وإرسال ترويسة Authorization مخصصة، كما يوصي بحفظ مفاتيح API ضمن أسرار Edge Function عبر لوحة Supabase أو CLI، لا في الواجهة. المصادر: https://supabase.com/docs/reference/javascript/functions-invoke وhttps://supabase.com/docs/guides/functions/secrets

تُعطّل وظيفة `notes-ai` تحقق Supabase JWT في بوابة Edge فقط لأنها تستقبل Google ID token؛ وتتحقق الوظيفة بنفسها من التوقيع عبر Google JWKS ومن `aud` و`iss` و`exp`. وثائق Google الرسمية: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token، واكتشاف OIDC يحدد JWKS عند https://www.googleapis.com/oauth2/v3/certs من https://accounts.google.com/.well-known/openid-configuration. نمط Supabase: https://supabase.com/docs/guides/functions/auth

نموذج Gemini `gemini-3.8-flash` مستقر ومدرج ضمن أسعار الطبقة المجانية الحالية؛ توضح صفحة التسعير أن بيانات الطبقة المجانية قد تُستخدم لتحسين منتجات Google. أُضيف تنبيه ظاهر للمستخدم قبل الإرسال. المصادر: https://ai.google.dev/gemini-api/docs/models وhttps://ai.google.dev/gemini-api/docs/pricing

واجهة Gemini REST المستخدمة هي `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` مع `systemInstruction` و`contents` و`generationConfig`. وثائق API: https://ai.google.dev/api/generate-content. تعليمات حماية المفتاح: https://ai.google.dev/gemini-api/docs/api-key

نشر الوظيفة وإعداد `verify_jwt` موثقان في https://supabase.com/docs/guides/functions/deploy. أسرار Gemini وGoogle Client ID وقائمة الأصول المسموحة تظل إعدادات خادم Supabase؛ لا تُكتب أي قيمة سرية في ملفات المشروع.
