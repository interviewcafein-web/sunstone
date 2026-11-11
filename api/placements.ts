// GET /api/placements?kind=full-time|internship[&campus=ID]: the Placements page. Staff only,
// and campus staff only for their campuses; they see averages but not each student's pay.
// The numbers come from api/_placements.ts.

import { json, seesCampus, sessionViewer } from './_auth';
import { forApp } from './_app';
import { placementReport, placementRowsSnapshot, type Kind } from './_placements';
import type { WaitUntil } from './_snapshot';

export const config = { runtime: 'edge' };

async function handler(request: Request, context?: WaitUntil): Promise<Response> {
  if (!process.env.DATABASE_URL) return json(404, { error: 'No database configured' });
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });

  const params = new URL(request.url).searchParams;
  const kind: Kind = params.get('kind') === 'internship' ? 'internship' : 'full-time';
  const rawCampus = params.get('campus');
  const campusId = rawCampus && /^\d+$/.test(rawCampus) ? Number(rawCampus) : null;
  if (campusId !== null && !seesCampus(viewer, campusId)) {
    return json(403, { error: 'You do not have access to this campus' });
  }
  try {
    const { students, syncedAt } = await placementRowsSnapshot(context);
    const report = placementReport(students, viewer, {
      kind,
      campusId,
      showPay: viewer.role !== 'campus',
    });
    return json(200, { ...report, syncedAt });
  } catch (error) {
    console.error('[placements]', error);
    return json(503, { error: 'Placements could not be loaded. Try again shortly.' });
  }
}

export default forApp(handler);
