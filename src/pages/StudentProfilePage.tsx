import { useEffect } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';

import { Card } from '@/components/coding/ui';
import { useStudent } from '@/hooks/useStudents';
import { ProfileView } from '@/pages/ProfilesPage';
import { PageLoader } from '@/components/common/PageLoader';

const route = getRouteApi('/s/$slug');

/** A student's profile from their link, /s/{username}. */
export default function StudentProfilePage() {
  const { slug } = route.useParams();
  const navigate = useNavigate();
  const lookup = useStudent(slug);
  const student = lookup.data ?? undefined;

  // An old address (from before usernames) found the student: show their current one.
  useEffect(() => {
    if (student && student.slug !== slug) {
      navigate({ to: '/s/$slug', params: { slug: student.slug }, replace: true });
    }
  }, [student, slug, navigate]);

  if (!student) {
    if (lookup.isPending) return <PageLoader variant="profile" label="Loading the profile" />;
    return (
      <Card>
        <p className="font-semibold">This profile could not be found.</p>
        <p className="mt-1 text-sm text-slate-600">
          The link may be out of date, or the student is no longer on Sunstone PRIME Vertex.
        </p>
        <Link
          to="/"
          className="text-brand-700 dark:text-brand-300 mt-3 inline-block text-sm font-semibold hover:underline"
        >
          Back to all students
        </Link>
      </Card>
    );
  }

  return (
    <ProfileView
      key={slug}
      name={student.name}
      handles={student.handles}
      student={student}
      onSubmit={(handles) => navigate({ to: '/profile', search: handles })}
    />
  );
}
