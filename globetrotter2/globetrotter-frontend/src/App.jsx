// Top-level route map for the whole app.
//
// Almost everything now renders inside <Layout/>, which draws the app shell:
// the header (menu, notification bell, theme toggle) and the row of the three
// main destinations. Screens no longer draw their own header, so the bell and
// the theme behave the same everywhere instead of five slightly different ways.
//
// Only the screens that exist OUTSIDE the app sit outside the shell: login and
// onboarding (you have no account yet, so there is nothing to navigate to).
//
// ITINERARIES ARE THREE SEPARATE SCREENS
// --------------------------------------
// They used to be one page that showed the builder form, every saved trip and
// all of their details stacked together. Now:
//   /itinerary        - an overview list of your trips, nothing else
//   /itinerary/new    - the builder
//   /itinerary/:id    - one trip in full, with its route drawn on the map

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import { ThemeProvider } from "./theme";
import { NotificationsProvider } from "./notifications";
import { AuthProvider } from "./auth";

import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Destinations from "./pages/Destinations";
import ForYou from "./pages/ForYou";
import MapPage from "./pages/Map";
import Itinerary from "./pages/Itinerary";
import ItineraryNew from "./pages/ItineraryNew";
import ItineraryDetail from "./pages/ItineraryDetail";
import SiteDetail from "./pages/SiteDetail";
import ManagePlaces from "./pages/ManagePlaces";
import PlaceForm from "./pages/PlaceForm";
import AiChat from "./pages/AiChat";
import ChatList from "./pages/ChatList";
import Chat from "./pages/Chat";
import Payment from "./pages/Payment";
import Profile from "./pages/Profile";
import Favorites from "./pages/Favorites";
import Notifications from "./pages/Notifications";
import NotificationDetail from "./pages/NotificationDetail";
// The observability dashboard - see /metrics in the app, and
// backend/app/metrics.py for where the numbers come from.
import Metrics from "./pages/Metrics";
// The two new screens for the roles/approval-workflow feature.
import MyRequests from "./pages/MyRequests";
import AdminRequests from "./pages/AdminRequests";
// The ratings leaderboard.
import TopRated from "./pages/TopRated";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <NotificationsProvider>
        <BrowserRouter>
          <Routes>
            {/* Explore is public - anyone can browse without an account, so
                the front door opens straight onto it rather than the login. */}
            <Route path="/" element={<Navigate to="/destinations" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Everything else shares the header + the three-destination row */}
            <Route element={<Layout />}>
              <Route path="/destinations" element={<Destinations />} />
              <Route path="/map" element={<MapPage />} />

              <Route path="/itinerary" element={<Itinerary />} />
              <Route path="/itinerary/new" element={<ItineraryNew />} />
              <Route path="/itinerary/:itineraryId" element={<ItineraryDetail />} />

              <Route path="/for-you" element={<ForYou />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/site/:destinationId" element={<SiteDetail />} />

              <Route path="/places" element={<ManagePlaces />} />
              <Route path="/places/new" element={<PlaceForm />} />
              <Route path="/places/:placeId/edit" element={<PlaceForm />} />
              {/* Regular users: track their own create/edit/delete suggestions.
                  Admins: the review queue for everyone else's suggestions. */}
              <Route path="/places/my-requests" element={<MyRequests />} />
              <Route path="/places/requests" element={<AdminRequests />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/ratings" element={<TopRated />} />
              <Route path="/ai-chat" element={<AiChat />} />
              {/* Chat Service: room list + one conversation. /global-chat
                  redirects here for anyone with the old URL bookmarked -
                  "global" is still a valid room id (see chat-service/app/
                  storage.py's PUBLIC_ROOM_ID). */}
              <Route path="/chat" element={<ChatList />} />
              <Route path="/chat/:roomId" element={<Chat />} />
              <Route path="/global-chat" element={<Navigate to="/chat/global" replace />} />
              <Route path="/payment" element={<Payment />} />

              <Route path="/notifications" element={<Notifications />} />
              <Route path="/notifications/:notificationId" element={<NotificationDetail />} />

              {/* The URL is /system-health, not /metrics, because the backend already
                  serves the raw JSON at /metrics - two different things at one address
                  would collide. */}
              <Route path="/system-health" element={<Metrics />} />
            </Route>

            {/* Anything else - send them somewhere real rather than a blank page */}
            <Route path="*" element={<Navigate to="/destinations" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
