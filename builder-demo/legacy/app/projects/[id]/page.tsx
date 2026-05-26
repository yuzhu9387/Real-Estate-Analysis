import { ProjectPageClient } from './project-page-client';

export function generateStaticParams() {
  return [{ id: 'prj-9-greenwood-pl' }];
}

export default function Page() {
  return <ProjectPageClient />;
}
