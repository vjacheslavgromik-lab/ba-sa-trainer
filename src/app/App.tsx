import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import ModulesPage from "../features/modules/ModulesPage";
import ModulePage from "../features/modules/ModulePage";
import TheoryView from "../features/modules/TheoryView";
import CasesView from "../features/modules/CasesView";
import TrainersView from "../features/modules/TrainersView";

function Home() {
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title">Освойте системный анализ по шагам</h1>
      <p>Выберите модуль в любом порядке. Прогресс пока не сохраняется.</p>
      <NavLink to="/modules">Перейти к модулям</NavLink>
    </section>
  );
}

export default function App() {
  return (
    <HashRouter>
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <header className="app-header">
        <span className="app-header__brand">BA → System Analyst</span>
        <nav aria-label="Основная навигация">
          <NavLink to="/">Главная</NavLink>
          <NavLink to="/modules">Модули</NavLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/modules/:id" element={<ModulePage />}>
            <Route index element={<Navigate to="theory" replace />} />
            <Route path="theory" element={<TheoryView />} />
            <Route path="cases" element={<CasesView />} />
            <Route path="trainers" element={<TrainersView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
