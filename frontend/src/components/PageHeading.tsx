export function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="min-w-0">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight wrap-anywhere sm:text-[2.25rem]">{title}</h1>
      <p className="mt-2 max-w-[68ch] text-muted text-pretty wrap-anywhere">{description}</p>
    </header>
  )
}
