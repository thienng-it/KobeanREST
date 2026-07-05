import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { DownloadsPage } from "./pages/DownloadsPage";
import { DeveloperPage } from "./pages/DeveloperPage";
import { HomePage } from "./pages/HomePage";
import { ProductPage } from "./pages/ProductPage";
import { QaPage } from "./pages/QaPage";
import { ReleasePage } from "./pages/ReleasePage";
import { RoadmapPage } from "./pages/RoadmapPage";
import { parseRoute, type SiteRoute } from "./site";

function getRoute() {
  return parseRoute(window.location.hash);
}

export function App() {
  const [route, setRoute] = useState<SiteRoute>(() => getRoute());

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  const pages: Record<SiteRoute, React.ReactNode> = {
    home: <HomePage />,
    product: <ProductPage />,
    downloads: <DownloadsPage />,
    developer: <DeveloperPage />,
    release: <ReleasePage />,
    roadmap: <RoadmapPage />,
    qa: <QaPage />,
  };

  return <AppShell activeRoute={route}>{pages[route]}</AppShell>;
}
