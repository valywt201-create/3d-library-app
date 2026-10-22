import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export type LegalDocument = 'privacy' | 'terms'
interface Props {
  document: LegalDocument | null
  onSelect: (document: LegalDocument) => void
  onClose: () => void
}
interface LegalSection { heading: string; paragraphs: string[] }
interface LegalContent { title: string; summary: string; sections: LegalSection[] }

const LAST_UPDATED = '٢٢ أكتوبر ٢٠٢٦'
const content: Record<LegalDocument, LegalContent> = {
  privacy: {
    title: 'سياسة الخصوصية',
    summary: 'تشرح هذه السياسة أنواع البيانات التي قد تعالجها المكتبة الرقمية، وأغراض استخدامها، والخيارات المتاحة لك. تنطبق على التطبيق ومزاياه المحلية والسحابية والذكية بحسب ما تختار استخدامه وإعداده.',
    sections: [
      { heading: '١. الجهة المسؤولة ونطاق السياسة', paragraphs: [
        'مشغّل التطبيق هو [اسم الجهة أو الشخص القانوني]، وعنوان التواصل الخاص بالخصوصية هو [البريد الإلكتروني أو وسيلة التواصل]. يجب استكمال هاتين القيمتين وبيانات النشاط والولاية القضائية قبل إتاحة الخدمة للجمهور.',
        'تصف هذه الوثيقة طريقة معالجة التطبيق للبيانات، ولا تحل محل إشعارات الخصوصية أو شروط مزودي الخدمات الخارجيين الذين تختار استخدامهم.'
      ] },
      { heading: '٢. البيانات التي قد نعالجها', paragraphs: [
        'بيانات الحساب: معرّف المستخدم ومعلومات الحساب التي يوفّرها مزود تسجيل الدخول، مثل الاسم أو البريد أو الصورة، بحسب إعدادات حسابك ومزود الهوية.',
        'محتوى المكتبة: الملفات والملاحظات والعناوين وبنية الأقسام والفروع. يُخزَّن المحتوى المحلي في مساحة تخزين المتصفح على جهازك. وقد تُعالج بيانات محددة عبر Supabase عند استخدام مزايا الحساب أو المزامنة أو المساحات المشتركة المفعّلة.',
        'بيانات الاستخدام: يسجل عدّاد الذكاء الاصطناعي معرّف الحساب وتاريخ UTC وعدد الطلبات لتطبيق الحد اليومي. لا يتضمن صف العداد نص السؤال أو محتوى الملف.',
        'بيانات تقنية أساسية قد تنتج عن الاتصال بالخدمات، مثل عنوان الشبكة ومعلومات المتصفح ووقت الطلب، وفق ما تسجله البنية التحتية ومزودوها.'
      ] },
      { heading: '٣. معالجة الملفات والذكاء الاصطناعي', paragraphs: [
        'تُستخرج النصوص القابلة للقراءة من الملفات محلياً في متصفحك. عند إرسال سؤال إلى مساعد المكتبة، يختار التطبيق المقاطع التي تبدو أكثر صلة من ملفات المكتبة ويضمّها إلى السؤال، ثم يرسلها عبر وظيفة Supabase إلى خدمة Google Gemini لتوليد الرد.',
        'لا يُرسل الملف الصوتي تلقائياً: يجب أن تحدده صراحةً من الواجهة. يسمح التطبيق حالياً بملفين صوتيين كحد أقصى، وبحجم أقصى يبلغ ١٫٢ ميغابايت لكل ملف. وقد تُرسل ملفات الصور أو المقاطع الصوتية المحددة إلى مزود الذكاء الاصطناعي عند طلب تحليلها.',
        'قد تُرسل بعض ميزات المساعد الأخرى النص الذي تختاره أو تكتبه إلى خدمة الذكاء الاصطناعي. لا ترسل كلمات مرور أو بيانات دفع أو سجلات طبية أو أسرار عمل أو محتوى لا تملك حق مشاركته. راجع شروط وسياسات Google وSupabase قبل استخدام هذه الميزات.'
      ] },
      { heading: '٤. أغراض المعالجة', paragraphs: [
        'نستخدم البيانات لتشغيل المكتبة وحفظ ما تختار مزامنته، وتسجيل الدخول وإدارة الجلسات، وتقديم البحث والمساعدة الذكية، وحماية الخدمة، وتطبيق حدود الاستخدام، ومعالجة الأعطال والطلبات التي تبادر بها.'
      ] },
      { heading: '٥. مزودو الخدمات والمشاركة', paragraphs: [
        'عند تفعيل ميزاتها، تتعامل الخدمة مع Supabase لاستضافة المصادقة وقاعدة البيانات والوظائف السحابية، ومع Google لتسجيل الدخول أو معالجة طلبات Gemini. تنتقل البيانات اللازمة فقط لتنفيذ الميزة التي تستخدمها، وفق إعدادات المشروع وعقود المزودين وسياساتهم.',
        'لا يمنح استخدام التطبيق الإذن بنشر ملفاتك علناً. ولا تُشارك محتويات المكتبة مع مستخدمين آخرين إلا عندما تختار ميزة مشاركة أو مساحة مشتركة وتؤكدها.'
      ] },
      { heading: '٦. التخزين والاحتفاظ والحذف', paragraphs: [
        'قد تبقى الملفات المحلية على جهازك حتى تحذفها من التطبيق أو تمسح بيانات الموقع من المتصفح. حذف التطبيق أو تغيير الجهاز لا يضمن نقل النسخة المحلية أو استعادتها؛ احتفظ بنسخ احتياطية مما تحتاجه.',
        'تُحفظ بيانات الحساب والعداد السحابي طالما اقتضى تشغيل الحساب أو تطبيق حد الاستخدام، ثم وفق إعدادات الاحتفاظ والمتطلبات النظامية المطبقة على الجهة المشغّلة ومزوديها. لا نستطيع من خلال هذه الواجهة تحديد مدة احتفاظ سجلات البنية التحتية التابعة للمزودين.',
        'لطلب الوصول إلى بيانات حسابك أو تصحيحها أو حذفها، تواصل مع الجهة المشغّلة عبر [وسيلة التواصل]. قد نحتاج إلى التحقق من هويتك، وقد توجد بيانات يتعين الاحتفاظ بها لأسباب أمنية أو نظامية.'
      ] },
      { heading: '٧. الأمان', paragraphs: [
        'نستخدم ضوابط مناسبة لطبيعة الخدمة، مثل التحقق من جلسة الحساب، وتقييد الوصول إلى عدّاد الاستخدام، وإبقاء مفاتيح النماذج في أسرار الخادم لا في حزمة المتصفح. لا توجد وسيلة نقل أو تخزين مضمونة الأمان بالكامل؛ احمِ جهازك وحسابك ولا تشارك بيانات الدخول.'
      ] },
      { heading: '٨. حقوقك وخياراتك', paragraphs: [
        'يمكنك تجنب الميزات السحابية والذكية، وعدم تسجيل الدخول، وعدم تحديد ملفات صوتية. قد يؤدي ذلك إلى عدم توفر بعض وظائف التطبيق. كما يمكنك إدارة الملفات المحلية من واجهة المكتبة وطلب التعامل مع بيانات الحساب عبر وسيلة التواصل الموضحة أعلاه، مع مراعاة القوانين المطبقة.'
      ] },
      { heading: '٩. الأطفال والتغييرات والتواصل', paragraphs: [
        'الخدمة ليست مصممة لتشجيع الأطفال على إرسال معلوماتهم الشخصية. إذا كنت ولياً وتعتقد أن طفلاً أرسل بيانات شخصية دون موافقة لازمة، فتواصل مع الجهة المشغّلة عبر [وسيلة التواصل].',
        'قد تُحدَّث هذه السياسة عند تغيير التطبيق أو المتطلبات النظامية. سنعرض تاريخ آخر تحديث في هذه النافذة، وعلى الجهة المشغّلة إبلاغ المستخدمين بالتغييرات الجوهرية بالطريقة المناسبة.',
        'آخر تحديث: ' + LAST_UPDATED + '. مشغّل التطبيق: [اسم الجهة]. أسئلة الخصوصية: [البريد الإلكتروني أو وسيلة التواصل].'
      ] },
    ],
  },
  terms: {
    title: 'شروط الاستخدام',
    summary: 'تنظم هذه الشروط وصولك إلى المكتبة الرقمية واستخدامك لها. اقرأها مع سياسة الخصوصية. استكمل بيانات الجهة والولاية القضائية أدناه واطلب مراجعة مختص قبل الاعتماد عليها قانونياً.',
    sections: [
      { heading: '١. الجهة ونطاق الاتفاق', paragraphs: [
        'يُشغَّل التطبيق بواسطة [اسم الجهة أو الشخص القانوني]، المسجل أو المقيم في [المدينة والدولة]، ويمكن التواصل معه عبر [البريد الإلكتروني أو وسيلة التواصل]. يشير «التطبيق» إلى المكتبة الرقمية وواجهاتها ومزاياها المحلية والسحابية.',
        'باستخدامك التطبيق، فإنك تقر بأنك قرأت هذه الشروط وسياسة الخصوصية. إذا لم توافق عليها، فتوقف عن الاستخدام ولا ترسل ملفات إلى الخدمات الذكية.'
      ] },
      { heading: '٢. الأهلية والحساب وأمنه', paragraphs: [
        'يجب أن تكون مؤهلاً قانوناً لاستخدام الخدمة في بلدك. إذا كنت دون السن الذي يسمح به القانون المحلي، فلا تستخدم ميزات الحساب أو الذكاء الاصطناعي إلا بموافقة وليك وبما يجيزه القانون.',
        'أنت مسؤول عن دقة معلومات حسابك وعن حماية بيانات الدخول والجهاز الذي تستخدمه، وعن الأنشطة التي تتم من خلال جلستك. أخطر الجهة المشغّلة عبر [وسيلة التواصل] عند الاشتباه باستخدام غير مصرح به.'
      ] },
      { heading: '٣. المحتوى وحقوق الملكية', paragraphs: [
        'تحتفظ بحقوقك في الملفات والملاحظات التي تملكها أو تملك إذناً باستخدامها. أنت مسؤول عن قانونية المحتوى وعن امتلاك الحقوق والتراخيص اللازمة لإدخاله أو مشاركته أو معالجته.',
        'تمنح مشغّل التطبيق ومزودي البنية التحتية ترخيصاً محدوداً وغير حصري لمعالجة المحتوى الذي تختار إرساله، وذلك بالقدر اللازم لتشغيل الميزة المطلوبة وتقديم الرد وحماية الخدمة. لا تمنح هذه الشروط ملكية محتواك للمشغّل.',
        'لا ترفع مواداً تنتهك حقوق الغير أو الخصوصية أو السرية أو القانون، ولا تحاول تجاوز قيود الوصول أو تعطيل الخدمة أو فحصها بطريقة ضارة.'
      ] },
      { heading: '٤. مزايا الذكاء الاصطناعي والملفات', paragraphs: [
        'عند طلب المساعدة، قد يرسل التطبيق السؤال والمقاطع المسترجعة من الملفات التي أضفتها إلى مزود ذكاء اصطناعي عبر الخادم. لا يُرسل الصوت إلا بعد اختيارك الصريح. بمبادرتك استخدام الميزة، تطلب تنفيذ هذه المعالجة وفق سياسة الخصوصية وشروط مزودي الخدمات.',
        'المخرجات آلية وقد تكون خاطئة أو ناقصة أو غير ملائمة. تحقق منها قبل استخدامها، ولا تعتمد عليها وحدها في قرار طبي أو قانوني أو مالي أو أمني أو أكاديمي مهم، ولا تعتبرها بديلاً لمختص أو لمصدر موثوق.'
      ] },
      { heading: '٥. حدود الاستخدام والتوافر', paragraphs: [
        'قد تفرض الخدمة حدوداً للمعدل أو الاستخدام اليومي أو الحجم أو نوع الملف لأسباب تشغيلية وأمنية. الحد المهيأ حالياً لمساعد الذكاء الاصطناعي هو ٢٠ طلباً للحساب في اليوم، ويتجدد عند منتصف الليل UTC بعد تفعيل الترحيل والوظيفة في Supabase؛ وقد يتعذر تطبيقه قبل نشر إعدادات الخادم.',
        'تُقدَّم المزايا بحسب التهيئة والاتصال وتوفر خدمات الأطراف الخارجية. يجوز تعديلها أو تعليقها أو إيقافها للصيانة أو لأسباب أمنية أو قانونية، مع بذل جهد معقول لإشعار المستخدمين عند الاقتضاء.'
      ] },
      { heading: '٦. خدمات الأطراف الثالثة', paragraphs: [
        'قد يعتمد التطبيق على Google وSupabase ومزودين آخرين. يخضع استخدامك لخدماتهم لشروطهم وسياساتهم، ولا يتحكم مشغّل التطبيق في انقطاعاتهم أو ممارساتهم. لا تدخل بيانات دخولك الخارجية إلا في تدفق المصادقة الرسمي.'
      ] },
      { heading: '٧. الإيقاف والإنهاء', paragraphs: [
        'يمكنك التوقف عن استخدام التطبيق أو حذف محتواك المحلي. يجوز لمشغّل التطبيق تعليق الوصول عند إساءة الاستخدام أو الخطر الأمني أو مخالفة هذه الشروط أو متطلب قانوني. يظل حذف البيانات السحابية خاضعاً لآليات الحساب والاحتفاظ الموضحة في سياسة الخصوصية.'
      ] },
      { heading: '٨. الضمان والمسؤولية', paragraphs: [
        'يُقدَّم التطبيق بالقدر الذي يسمح به القانون «كما هو» و«حسب التوفر». لا يضمن المشغّل خلوه من الأعطال أو فقدان البيانات أو دقة المخرجات أو ملاءمتها لغرض معين، مع عدم استبعاد أي ضمان أو حق لا يسمح القانون باستبعاده.',
        'إلى أقصى حد يسمح به القانون، لا يتحمل المشغّل مسؤولية الأضرار غير المباشرة أو فقدان البيانات الناتج عن عدم الاحتفاظ بنسخة احتياطية أو اعتمادك على مخرجات آلية. لا تحد هذه الشروط مسؤولية لا يجوز قانوناً تقييدها.'
      ] },
      { heading: '٩. التغييرات والقانون والتواصل', paragraphs: [
        'قد تتغير هذه الشروط عند تطوير الخدمة أو تغير المتطلبات النظامية. يبدأ سريان التحديث عند نشره، وتُبلَّغ التغييرات الجوهرية بالطريقة المناسبة. استمرارك في استخدام التطبيق بعد سريان التغيير يعني قبولك به بالقدر الذي يجيزه القانون؛ وإلا فتوقف عن الاستخدام.',
        'يخضع هذا الاتفاق لقوانين [الدولة أو الولاية القضائية]، وتُنظر النزاعات أمام الجهات المختصة فيها، مع مراعاة القواعد الآمرة وحقوق المستهلك التي لا يجوز التنازل عنها.',
        'آخر تحديث: ' + LAST_UPDATED + '. مشغّل التطبيق: [اسم الجهة]. للاستفسارات والشكاوى: [البريد الإلكتروني أو وسيلة التواصل].'
      ] },
    ],
  },
}

export default function LegalModal({ document: activeDocument, onSelect, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentForDocument = activeDocument ? content[activeDocument] : null
  const isOpen = activeDocument !== null

  useEffect(() => {
    if (!isOpen) return undefined
    const previousFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.document.addEventListener('keydown', onKeyDown)
    return () => {
      window.document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {contentForDocument && (
        <motion.div
          key="legal-modal"
          className="fixed inset-0 z-[2200] flex items-center justify-center p-3 sm:p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
          <motion.section
            ref={dialogRef}
            role="dialog" aria-modal="true" aria-labelledby="legal-title" dir="rtl"
            className="glass-strong relative flex max-h-[min(88dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            onMouseDown={event => event.stopPropagation()}
          >
            <header className="shrink-0 border-b border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] opacity-60">آخر تحديث: {LAST_UPDATED}</p>
                  <h2 id="legal-title" className="mt-1 text-lg font-semibold text-violet-200">{contentForDocument.title}</h2>
                </div>
                <button ref={closeRef} type="button" aria-label="إغلاق النافذة القانونية" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"><X size={19} /></button>
              </div>
              <nav aria-label="اختيار الوثيقة القانونية" className="mt-3 flex flex-wrap gap-2">
                <button type="button" aria-current={activeDocument === 'privacy' ? 'page' : undefined} onClick={() => onSelect('privacy')} className={`rounded-lg px-3 py-2 text-xs transition ${activeDocument === 'privacy' ? 'bg-violet-300 text-slate-950' : 'bg-white/10 hover:bg-white/15'}`}>سياسة الخصوصية</button>
                <button type="button" aria-current={activeDocument === 'terms' ? 'page' : undefined} onClick={() => onSelect('terms')} className={`rounded-lg px-3 py-2 text-xs transition ${activeDocument === 'terms' ? 'bg-violet-300 text-slate-950' : 'bg-white/10 hover:bg-white/15'}`}>شروط الاستخدام</button>
              </nav>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <p className="mb-5 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-7 text-white/80">{contentForDocument.summary}</p>
              <nav aria-label="فهرس الوثيقة" className="mb-6 rounded-xl border border-white/10 bg-black/10 p-3">
                <h3 className="mb-2 text-xs font-semibold text-violet-200">فهرس الوثيقة</h3>
                <ol className="grid gap-1.5 sm:grid-cols-2">
                  {contentForDocument.sections.map((section, index) => (
                    <li key={section.heading}>
                      <a href={`#legal-section-${index}`} className="text-xs leading-6 text-white/70 underline decoration-white/20 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300">{section.heading}</a>
                    </li>
                  ))}
                </ol>
              </nav>
              <div className="space-y-6 text-sm leading-7 text-white/80">
                {contentForDocument.sections.map((section, index) => (
                  <section key={section.heading} id={`legal-section-${index}`} className="scroll-mt-4 space-y-2">
                    <h3 className="border-b border-white/10 pb-2 text-sm font-semibold text-white">{section.heading}</h3>
                    {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                  </section>
                ))}
              </div>
              <p className="mt-7 rounded-xl border border-amber-200/15 bg-amber-100/[0.04] p-3 text-xs leading-6 text-amber-100/85">نص عربي شامل للإعداد الأولي، وليس استشارة قانونية. استبدل جميع الحقول بين معقوفين ببيانات الجهة والولاية القضائية، واطلب مراجعة قانونية محلية قبل النشر العام.</p>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
