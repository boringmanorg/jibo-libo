import { useLocation } from '@tanstack/react-router';
import { rankedQuestionsFor } from '@/data/rankedPageQuestions';

/** Always-visible editorial answers. No additional FAQPage rich-result markup. */
export default function RankedPageQuestions({ path }: { path?: string }) {
  const location = useLocation();
  const questions = rankedQuestionsFor(path ?? location.pathname);
  if (!questions) return null;
  return (
    <section data-ranked-questions aria-labelledby="ranked-questions-heading" className="xt w-full border-t border-xt-line bg-xt-paper px-4 py-12 text-xt-ink sm:px-8 lg:px-16">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-12">
        <h2 id="ranked-questions-heading" className="xt-display m-0 text-[36px] leading-tight sm:text-[44px] lg:col-span-4">People also ask</h2>
        <div className="divide-y divide-xt-line lg:col-span-8">
          {questions.map(({ q, a }) => (
            <div key={q} className="py-5 first:pt-0 last:pb-0">
              <h3 className="m-0 text-[17px] font-extrabold leading-relaxed">{q}</h3>
              <p className="m-0 mt-2 text-[16px] leading-relaxed text-xt-mute">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}