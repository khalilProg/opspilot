import { Link } from 'react-router'
import { PageHeading } from '../components/PageHeading'

export function NotFoundPage() {
  return (
    <>
      <PageHeading title="Page not found" description="This dashboard page is unavailable." />
      <Link to="/" className="action-link">Back to overview</Link>
    </>
  )
}
