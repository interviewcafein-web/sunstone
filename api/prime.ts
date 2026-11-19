// Converge's PRIME Domain page (api/_prime.ts). Staff only; campus staff see their campuses.
//
//   GET /api/prime[?campus=ID]   subjects (tests, assignments, hours), AMCAT, the opt-in
//                                comparison and PRIME against placements
//   PUT /api/prime               { campusId, program, admissionYear, subject, hours | null }
//                                HQ sets (or clears, with null) a subject's planned hours

import { json, managesTeam, seesCampus, sessionViewer } from './_auth';
import { forApp } from './_app';
import { db } from './_db';
import { placementReport, placementRowsSnapshot } from './_placements';
import { HOURS_PER_CREDIT, narrow, optInComparison, plannedHours, primeRows } from './_prime';
import { snapshot, type WaitUntil } from './_snapshot';

export const config = { runtime: 'edge' };

async function handler(request: Request, context?: WaitUntil): Promise<Response> {
  if (!process.env.DATABASE_URL) return json(404, { error: 'No database configured' });
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });

  if (request.method === 'PUT') {
    if (!managesTeam(viewer)) return json(403, { error: 'Only HQ can set planned hours' });
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const campusId = Number(body?.campusId);
    const year = Number(body?.admissionYear);
    const program = typeof body?.program === 'string' ? body.program.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const hours = body?.hours == null ? null : Number(body.hours);
    if (!Number.isInteger(campusId) || !Number.isInteger(year) || !program || !subject) {
      return json(400, { error: 'Choose the campus, batch and subject' });
    }
    if (hours !== null && !(hours >= 0 && hours <= 1000)) {
      return json(400, { error: 'Planned hours must be between 0 and 1000' });
    }
    if (hours === null) {
      await db()`delete from prime_planned_hours where campus_id = ${campusId}
        and program = ${program} and admission_year = ${year} and subject = ${subject}`;
    } else {
      await db()`insert into prime_planned_hours (campus_id, program, admission_year, subject, hours, set_by)
        values (${campusId}, ${program}, ${year}, ${subject}, ${hours}, ${viewer.user})
        on conflict (campus_id, program, admission_year, subject)
        do update set hours = excluded.hours, set_by = excluded.set_by, set_at = now()`;
    }
    return json(200, { ok: true });
  }

  const raw = new URL(request.url).searchParams.get('campus');
  const campusId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (campusId !== null && !seesCampus(viewer, campusId)) {
    return json(403, { error: 'You do not have access to this campus' });
  }
  const scope = campusId !== null ? [campusId] : viewer.campusIds;
  try {
    const [rows, planned, optIn, placementRows] = await Promise.all([
      snapshot('prime', primeRows, context),
      plannedHours(scope),
      optInComparison(scope),
      placementRowsSnapshot(context),
    ]);
    const plannedBy = new Map(
      planned.map((row) => [
        `${row.campus_id}|${row.program}|${row.admission_year}|${row.subject}`,
        row,
      ])
    );
    const subjects = narrow(rows.subjects, viewer, campusId).map((row) => {
      const set = plannedBy.get(
        `${row.campus_id}|${row.program}|${row.admission_year}|${row.subject}`
      );
      return {
        ...row,
        planned_hours: set ? set.hours : row.credits ? row.credits * HOURS_PER_CREDIT : null,
        planned_source: set ? 'hq' : row.credits ? 'credits' : null,
        planned_by: set?.set_by ?? null,
      };
    });
    const showPay = viewer.role !== 'campus';
    const placement = (['full-time', 'internship'] as const).map((kind) => {
      const report = placementReport(placementRows.students, viewer, { kind, campusId, showPay });
      return {
        kind,
        totals: report.totals,
        measures: report.measures,
        prep: report.prep,
        fit: report.fit,
        roles: report.roles,
      };
    });
    const campuses = [
      ...new Map(narrow(rows.subjects, viewer, null).map((row) => [row.campus_id, row.campus])),
    ]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json(200, {
      campuses,
      subjects,
      amcat: narrow(rows.amcat, viewer, campusId),
      optIn,
      placement,
      hoursPerCredit: HOURS_PER_CREDIT,
      canEditPlanned: managesTeam(viewer),
      syncedAt: placementRows.syncedAt,
    });
  } catch (error) {
    console.error('[prime]', error);
    return json(503, { error: 'The PRIME overview could not be loaded. Try again shortly.' });
  }
}

export default forApp(handler);
