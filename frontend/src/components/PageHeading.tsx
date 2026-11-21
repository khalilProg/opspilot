export function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-7">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{description}</p>
    </header>
  )
}
