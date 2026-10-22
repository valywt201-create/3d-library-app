# 3D Library App - Context & Roadmap

## 🎯 Overview
An interactive academic document and PDF transformation platform with AI summaries, flashcards, quizzes, and 3D visual modules.

## 🚀 Active Stack
- React / Vite / TypeScript
- Tailwind CSS
- Roo Code AI Assistant (Gemini API)

## حالة ميزة مساعد الدراسة
- ملاحظات كل فرع تُحفظ محلياً في IndexedDB بمفتاح معرّف العقدة.
- مساعد الدراسة يستدعي Supabase Edge Function، ولا يرسل مفتاح Gemini إلى المتصفح.
- تُرسل الملاحظات إلى Gemini فقط بعد ضغط المستخدم على إجراء المساعد.
- تتحقق الوظيفة من Google ID token بتوقيع Google والجمهور والانتهاء قبل طلب النموذج.
- تُحفظ أسرار Gemini وإعدادات الوظيفة في Supabase، لا في ملفات العميل.

## 📌 Rules for AI Agent
- Before making major code changes, update this context file.
- Work incrementally: write small, testable chunks of code.
- Always check .clinerules for UI/UX guidelines before rendering components.
