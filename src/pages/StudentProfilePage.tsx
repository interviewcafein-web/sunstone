import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';

import { Card } from '@/components/coding/ui';
import { useStudents } from '@/hooks/useStudents';
import { LoadingCard, ProfileView } from '@/pages/ProfilesPage';

const route = getRouteApi('/s/$slug');

/** A student's profile from the short link: their usernames come from the sheet. */
export default function StudentProfilePage() {
  const { slug } = route.useParams();
  const navigate = useNavigate();
  const students = useStudents();
  const student = students.data?.students.find((candidate) => candidate.slug === slug);

  if (!student) {
    if (students.isPending) return <LoadingCard label="Loading profile…" />;
    return (
      <Card>
        <p className="font-semibold">This profile could not be found.</p>
        <p className="mt-1 text-sm text-slate-600">
          The link may be out of date, or the student's sheet entry has changed.
        </p>
        <Link
          to="/"
          className="text-brand-700 mt-3 inline-block text-sm font-semibold hover:underline"
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
