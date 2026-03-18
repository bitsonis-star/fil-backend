import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Narrative from "@/pages/Narrative";
import Matches from "@/pages/Matches";
import Subscription from "@/pages/Subscription";
import Photos from "@/pages/Photos";
import Social from "@/pages/Social";
import Events from "@/pages/Events";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/narrative"} component={Narrative} />
      <Route path={"/matches"} component={Matches} />
      <Route path={"/subscription"} component={Subscription} />
      <Route path={"/photos"} component={Photos} />
      <Route path={"/social"} component={Social} />
      <Route path={"/events"} component={Events} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
