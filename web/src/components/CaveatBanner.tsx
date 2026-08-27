import Link from "next/link";

export function CaveatBanner() {
  return (
    <aside
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-stone-900"
      aria-label="Important caveat"
    >
      <div className="mx-auto max-w-5xl">
        <p>
          These figures are <strong>modeled estimates</strong>, not measurements.
          Each percentage is the right tail of a normal distribution given a
          published PISA 2022 mathematics country mean and SD (default 100), for
          15-year-olds in school. This is scholastic achievement,{" "}
          <strong>not IQ</strong>. This is <strong>not</strong> a ranking of
          people, nations, or worth, and not a map of who can use AI.{" "}
          <Link href="/methodology/" className="font-medium underline">
            Read the methodology.
          </Link>
        </p>
      </div>
    </aside>
  );
}
