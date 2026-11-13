import { useEffect } from 'react';
import { PageHeader } from '../components/Layout';
import { StatusPill, TutorConversation } from '../components/TutorPanel';
import { useTutor } from '../lib/tutorContext';

export function TutorPage() {
  const t = useTutor();
  // the drawer and this page share one conversation; close the drawer here
  useEffect(() => {
    t.setOpen(false);
    if (t.availability.state === 'checking') t.refreshAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <PageHeader
        title="AI tutor"
        subtitle="A grounded Kubernetes tutor: answers are built from this app's lessons and official references, with follow-up questions kept in context. Pick a mode to change how it teaches."
        actions={<StatusPill />}
      />
      <div className="card flex h-[70vh] min-h-[480px] flex-col p-0 pt-4">
        <TutorConversation />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Runs an open-weight model on free CPU hardware, so answers take a few seconds to stream and the service may sleep when idle. When it is unavailable you still get matching lesson content from the built-in knowledge base. See docs/AI_TUTOR.md for details.
      </p>
    </div>
  );
}
