import { HashRouter, Route, Routes, Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TutorProvider } from './lib/tutorContext';
import { Dashboard } from './pages/Dashboard';
import { PathPage } from './pages/Path';
import { LessonPage } from './pages/Lesson';
import { ExplorePage, NetworkPage, StoragePage } from './pages/Visualizers';
import { ComparePage, EcosystemPage, GlossaryPage, ResourcesPage, SearchPage } from './pages/Reference';
import { TerminalPage } from './pages/Terminal';
import { YamlPage } from './pages/YamlTrainer';
import { TroubleshootPage } from './pages/Troubleshoot';
import { DecisionsPage } from './pages/Decisions';
import { LabPage, LabsPage } from './pages/Labs';
import { PracticePage } from './pages/Practice';
import { ExamPage } from './pages/Exam';
import { ReviewPage } from './pages/Review';
import { FlashcardsPage } from './pages/Flashcards';
import { ReadinessPage } from './pages/Readiness';
import { SettingsPage } from './pages/Settings';
import { TutorPage } from './pages/TutorPage';
import { ArenaPage } from './pages/Arena';
import { DailyPage, ExplainPage, FeedPage, GamesPage, ProgressMapPage } from './pages/Play';
import { InfraBehavioral, InfraDesignCase, InfraDesignList, InfraHome, InfraMock, InfraReadinessPage, InfraResourcesPage } from './pages/Infra';

// Hash routing works identically on GitHub Pages (/KCNA/) and Hugging Face (/)
// without server-side rewrites.
export function App() {
  return (
    <HashRouter>
      <TutorProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/path" element={<PathPage />} />
            <Route path="/lessons/:id" element={<LessonPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/ecosystem" element={<EcosystemPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/yaml" element={<YamlPage />} />
            <Route path="/troubleshoot" element={<TroubleshootPage />} />
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/labs" element={<LabsPage />} />
            <Route path="/labs/:id" element={<LabPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/exam" element={<ExamPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/readiness" element={<ReadinessPage />} />
            <Route path="/tutor" element={<TutorPage />} />
            <Route path="/glossary" element={<GlossaryPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/arena" element={<ArenaPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/explain" element={<ExplainPage />} />
            <Route path="/map" element={<ProgressMapPage />} />
            <Route path="/infra" element={<InfraHome />} />
            <Route path="/infra/lessons/:id" element={<LessonPage />} />
            <Route path="/infra/practice" element={<PracticePage track="infra" />} />
            <Route path="/infra/design" element={<InfraDesignList />} />
            <Route path="/infra/design/:id" element={<InfraDesignCase />} />
            <Route path="/infra/behavioral" element={<InfraBehavioral />} />
            <Route path="/infra/mock" element={<InfraMock />} />
            <Route path="/infra/flashcards" element={<FlashcardsPage track="infra" />} />
            <Route path="/infra/readiness" element={<InfraReadinessPage />} />
            <Route path="/infra/resources" element={<InfraResourcesPage />} />
            <Route
              path="*"
              element={
                <div className="card">
                  <p>Page not found.</p>
                  <Link to="/" className="btn-primary mt-3">
                    Go to dashboard
                  </Link>
                </div>
              }
            />
          </Routes>
        </Layout>
      </TutorProvider>
    </HashRouter>
  );
}
