/** Can this page record at all? Browsers allow the microphone only on https or localhost. */
export function micAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

/** A one-line explanation for a failed recording attempt, in the learner's words. */
export function micProblem(e?: unknown): string {
  if (!micAvailable()) return 'الميكروفون لا يعمل على هذا العنوان (http). افتح العنوان المؤمّن https من الإعدادات → على هاتفك، أو استخدم التطبيق على الجهاز نفسه.';
  const name = (e as { name?: string } | undefined)?.name;
  if (name === 'NotAllowedError') return 'لم يُسمح بالميكروفون. افتح إعدادات المتصفح واسمح لهذا الموقع باستخدامه.';
  if (name === 'NotFoundError') return 'لم يُعثر على ميكروفون في هذا الجهاز.';
  return `تعذر الوصول إلى الميكروفون: ${String(e ?? '')}`;
}
