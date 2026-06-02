// Simple reusable section card with consistent styling
export default function SectionCard({ id, title, children, className = '' }) {
  return (
    <section
      id={id}
      className={`z-10 scroll-mt-20 rounded-xl bg-black/20 backdrop-blur-sm p-6 md:p-8 my-16 md:my-24 mx-1 md:mx-[10%] ${className}`}
      aria-labelledby={title ? `${id}-title` : undefined}
    >
      {title && (
        <h2 id={`${id}-title`} className="mb-4 text-2xl md:text-3xl font-semibold tracking-wide">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
